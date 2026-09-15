import {TTLCache,CircuitBreaker,fetchJson} from './runtime.mjs';

const cache=new TTLCache();
const breaker=new CircuitBreaker({threshold:3,cooldownMs:90_000});
const lastKnown=new Map();

function normalizeSymbol(symbol){
  try{ const map=JSON.parse(process.env.SYMBOL_MAP_JSON||'{}'); return map[symbol]||symbol; }catch{return symbol;}
}
function quality(provider){ return process.env[`${provider.toUpperCase().replace(/\W/g,'_')}_FRESHNESS`] || 'LIVE_OR_DELAYED'; }

const providers={
  async twelve(symbol){
    const key=process.env.TWELVE_DATA_API_KEY; if(!key) throw new Error('not_configured');
    const s=normalizeSymbol(symbol); const j=await fetchJson(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(s)}`,{headers:{Authorization:`apikey ${key}`}});
    if(!j.close || j.status==='error') throw new Error(j.message||'invalid_quote');
    return {symbol,provider:'Twelve Data',price:Number(j.close),changePct:Number(j.percent_change||0),currency:j.currency||'',timestamp:j.timestamp?new Date(Number(j.timestamp)*1000).toISOString():new Date().toISOString(),dataQuality:quality('twelve_data')};
  },
  async finnhub(symbol){
    const key=process.env.FINNHUB_API_KEY; if(!key) throw new Error('not_configured');
    const s=normalizeSymbol(symbol); const j=await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${encodeURIComponent(key)}`);
    if(!j.c) throw new Error('invalid_quote');
    return {symbol,provider:'Finnhub',price:Number(j.c),changePct:Number(j.dp||0),currency:'',timestamp:j.t?new Date(Number(j.t)*1000).toISOString():new Date().toISOString(),dataQuality:quality('finnhub')};
  },
  async alpha(symbol){
    const key=process.env.ALPHA_VANTAGE_API_KEY; if(!key) throw new Error('not_configured');
    const s=normalizeSymbol(symbol); const j=await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(s)}&apikey=${encodeURIComponent(key)}`,{timeoutMs:7000});
    const q=j['Global Quote']; if(!q || !q['05. price']) throw new Error(j.Note||j.Information||'invalid_quote');
    return {symbol,provider:'Alpha Vantage',price:Number(q['05. price']),changePct:Number(String(q['10. change percent']||'0').replace('%','')),currency:'',timestamp:new Date().toISOString(),dataQuality:quality('alpha_vantage')};
  }
};

export function configuredPriceProviders(){
  return [
    {id:'twelve',name:'Twelve Data',configured:Boolean(process.env.TWELVE_DATA_API_KEY)},
    {id:'finnhub',name:'Finnhub',configured:Boolean(process.env.FINNHUB_API_KEY)},
    {id:'alpha',name:'Alpha Vantage',configured:Boolean(process.env.ALPHA_VANTAGE_API_KEY)}
  ];
}

export async function getQuote(symbol,state){
  const ck=`q:${symbol}`; const hit=cache.get(ck); if(hit) return {...hit,cache:'HIT'};
  const order=(process.env.PRICE_PROVIDER_ORDER||'twelve,finnhub,alpha').split(',').map(x=>x.trim()).filter(Boolean);
  const attempts=[];
  for(const id of order){
    const fn=providers[id]; if(!fn) continue; if(!breaker.canTry(id)){ attempts.push({provider:id,status:'circuit_open'}); continue; }
    try{ const q=await fn(symbol); breaker.success(id); cache.set(ck,q,Number(process.env.PRICE_CACHE_TTL_MS||15000)); lastKnown.set(symbol,{...q,lastKnownAt:new Date().toISOString()}); return {...q,cache:'MISS',attempts}; }
    catch(e){ breaker.fail(id); attempts.push({provider:id,status:'error',error:String(e.message||e)}); }
  }
  const prior=lastKnown.get(symbol); if(prior) return {...prior,provider:`${prior.provider} cache`,dataQuality:'CACHED_LAST_KNOWN',stale:true,attempts};
  const h=state.holdings.find(h=>h.symbol===symbol);
  return h?{symbol,provider:'Demo fallback',price:h.price,changePct:h.dayPct,currency:h.currency,timestamp:new Date().toISOString(),dataQuality:'DEMO',stale:true,attempts}:{symbol,provider:'None',dataQuality:'UNAVAILABLE',attempts};
}

export function priceDiagnostics(){
  return configuredPriceProviders().map(p=>({...p,circuit:breaker.status(p.id)}));
}
