import {TTLCache,CircuitBreaker,fetchJson} from './runtime.mjs';
const cache=new TTLCache();
const breaker=new CircuitBreaker({threshold:3,cooldownMs:120_000});

function words(s){return new Set(String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2));}
function similarity(a,b){const A=words(a),B=words(b); if(!A.size||!B.size)return 0; let i=0; for(const x of A)if(B.has(x))i++; return i/Math.max(A.size,B.size);}
function dedupe(items){
  const out=[];
  for(const x of items.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt))){
    const dup=out.find(y=>(x.url&&y.url&&x.url===y.url)||similarity(x.title,y.title)>=0.82);
    if(dup){ dup.sources=[...(dup.sources||[dup.source]),x.source].filter((v,i,a)=>a.indexOf(v)===i); continue; }
    out.push({...x,sources:[x.source]});
  }
  return out;
}
function infer(text){const t=text.toLowerCase(); const bull=['beat','raises guidance','upgrade','record revenue','buyback','approval','contract win']; const bear=['miss','cuts guidance','downgrade','lawsuit','probe','recall','offering']; let score=0; for(const x of bull)if(t.includes(x))score++; for(const x of bear)if(t.includes(x))score--; return score>0?'Bullish':score<0?'Bearish':'Neutral';}
function decorate(x,symbols=[]){const hay=(x.title+' '+(x.summary||'')).toUpperCase(); const tagged=symbols.filter(s=>hay.includes(s.replace('.BK','').replace('/USD',''))); return {...x,symbols:x.symbols?.length?x.symbols:tagged,sentiment:x.sentiment||infer(hay),confidence:x.confidence||'Medium',relevance:x.relevance||Math.min(95,tagged.length?85:55),eventType:x.eventType||'News'};}
function parseRss(xml,source){
  const out=[]; const items=xml.match(/<item[\s\S]*?<\/item>/gi)||[];
  for(const item of items.slice(0,40)){
    const pick=(tag)=>((item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))||[])[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').trim();
    const title=pick('title'),link=pick('link'),pubDate=pick('pubDate')||pick('dc:date'),summary=pick('description');
    if(title)out.push({id:`rss-${Buffer.from(link||title).toString('base64url').slice(0,28)}`,source,title,summary,url:link,publishedAt:pubDate||new Date().toISOString()});
  }
  return out;
}

const providerFns={
  async alpha(symbols){
    const key=process.env.ALPHA_VANTAGE_API_KEY; if(!key) throw new Error('not_configured');
    const tickers=symbols.filter(s=>!s.endsWith('.BK')&&!s.includes('/')).slice(0,8).join(',');
    const j=await fetchJson(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT${tickers?`&tickers=${encodeURIComponent(tickers)}`:''}&limit=50&apikey=${encodeURIComponent(key)}`,{timeoutMs:8000});
    if(!Array.isArray(j.feed)) throw new Error(j.Note||j.Information||'invalid_news');
    return j.feed.map((x,i)=>({id:`av-${i}-${x.time_published||''}`,source:x.source||'Alpha Vantage',title:x.title,summary:x.summary,url:x.url,publishedAt:x.time_published?x.time_published.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z'):new Date().toISOString(),sentiment:Number(x.overall_sentiment_score)>0.15?'Bullish':Number(x.overall_sentiment_score)<-0.15?'Bearish':'Neutral'}));
  },
  async newsapi(symbols){
    const key=process.env.NEWS_API_KEY; if(!key) throw new Error('not_configured');
    const q=(process.env.NEWS_API_QUERY||symbols.slice(0,6).map(s=>s.replace('.BK','')).join(' OR ')||'markets');
    const j=await fetchJson(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=50`,{headers:{'X-Api-Key':key},timeoutMs:8000});
    if(!Array.isArray(j.articles)) throw new Error(j.message||'invalid_news');
    return j.articles.map((x,i)=>({id:`na-${i}-${x.publishedAt||''}`,source:x.source?.name||'NewsAPI',title:x.title,summary:x.description||'',url:x.url,publishedAt:x.publishedAt||new Date().toISOString()}));
  },
  async finnhub(symbols){
    const key=process.env.FINNHUB_API_KEY; if(!key) throw new Error('not_configured');
    const end=new Date(); const start=new Date(Date.now()-7*86400000); const fmt=d=>d.toISOString().slice(0,10); const out=[];
    for(const symbol of symbols.filter(s=>!s.endsWith('.BK')&&!s.includes('/')).slice(0,4)){
      const j=await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(start)}&to=${fmt(end)}&token=${encodeURIComponent(key)}`,{timeoutMs:6000});
      if(Array.isArray(j)) out.push(...j.slice(0,15).map(x=>({id:`fh-${x.id||x.datetime}`,source:x.source||'Finnhub',title:x.headline,summary:x.summary||'',url:x.url,publishedAt:x.datetime?new Date(x.datetime*1000).toISOString():new Date().toISOString(),symbols:[symbol]})));
    }
    if(!out.length) throw new Error('empty_news'); return out;
  },
  async rss(){
    const feeds=(process.env.RSS_FEEDS||'').split(',').map(s=>s.trim()).filter(Boolean); if(!feeds.length) throw new Error('not_configured'); const all=[];
    for(const feed of feeds.slice(0,12)){
      try{const r=await fetch(feed,{headers:{'User-Agent':'PortfolioPulseAI/2.0 (+self-hosted)'}}); if(r.ok)all.push(...parseRss(await r.text(),new URL(feed).hostname));}catch{}
    }
    if(!all.length) throw new Error('empty_news'); return all;
  }
};

export function configuredNewsProviders(){return [
  {id:'alpha',name:'Alpha Vantage News',configured:Boolean(process.env.ALPHA_VANTAGE_API_KEY)},
  {id:'newsapi',name:'NewsAPI',configured:Boolean(process.env.NEWS_API_KEY)},
  {id:'finnhub',name:'Finnhub News',configured:Boolean(process.env.FINNHUB_API_KEY)},
  {id:'rss',name:'RSS feeds',configured:Boolean(process.env.RSS_FEEDS)}
];}

export async function getNews(state){
  const symbols=state.holdings.map(h=>h.symbol); const ck='news:'+symbols.sort().join(','); const hit=cache.get(ck); if(hit)return {...hit,cache:'HIT'};
  const order=(process.env.NEWS_PROVIDER_ORDER||'alpha,newsapi,finnhub,rss').split(',').map(x=>x.trim()).filter(Boolean); const all=[]; const providers=[];
  await Promise.all(order.map(async id=>{
    const fn=providerFns[id]; if(!fn||!breaker.canTry(id)){providers.push({id,status:'skipped'});return;}
    try{const items=await fn(symbols); breaker.success(id); providers.push({id,status:'ok',count:items.length}); all.push(...items.map(x=>decorate(x,symbols)));}
    catch(e){breaker.fail(id);providers.push({id,status:'error',error:String(e.message||e)});}
  }));
  let items=dedupe(all).slice(0,100); let mode='MULTI_PROVIDER';
  if(!items.length){items=state.news;mode='DEMO';}
  const result={mode,items,providers,generatedAt:new Date().toISOString()}; cache.set(ck,result,Number(process.env.NEWS_CACHE_TTL_MS||180000)); return {...result,cache:'MISS'};
}

export function newsDiagnostics(){return configuredNewsProviders().map(p=>({...p,circuit:breaker.status(p.id)}));}
