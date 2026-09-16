const http=require('http');
const fs=require('fs');
const path=require('path');
const {KEYS,doSearch,doQuote,doHistory}=require('./api/_providers');
const PORT=Number(process.env.PORT||8787),ROOT=__dirname;
const AUTO_REFRESH_MS=Math.max(10000,Number(process.env.AUTO_REFRESH_MS||30000));
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
async function pooled(items,limit,fn){const out=new Array(items.length);let next=0;async function worker(){while(true){const i=next++;if(i>=items.length)break;try{out[i]=await fn(items[i])}catch(e){out[i]={symbol:items[i],error:e.message}}}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out}
async function api(req,res,u){
  try{
    if(u.pathname==='/api/health')return send(res,200,{ok:true,providers:{twelve:!!KEYS.twelve,finnhub:!!KEYS.finnhub,alpha:!!KEYS.alpha},runtime:'node',autoRefreshMs:AUTO_REFRESH_MS});
    if(u.pathname==='/api/search')return send(res,200,{ok:true,items:await doSearch((u.searchParams.get('q')||'').trim())});
    if(u.pathname==='/api/quote')return send(res,200,{ok:true,quote:await doQuote((u.searchParams.get('symbol')||'').trim())});
    if(u.pathname==='/api/quotes'){
      const symbols=[...new Set((u.searchParams.get('symbols')||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,50);
      if(!symbols.length)return send(res,400,{ok:false,error:'Missing symbols'});
      const results=await pooled(symbols,4,doQuote);return send(res,200,{ok:true,quotes:results.filter(x=>x&&!x.error),errors:results.filter(x=>x&&x.error),syncedAt:new Date().toISOString()});
    }
    if(u.pathname==='/api/history')return send(res,200,{ok:true,history:await doHistory((u.searchParams.get('symbol')||'').trim(),u.searchParams.get('range')||'1Y')});
    return false;
  }catch(e){send(res,503,{ok:false,error:e.message});return true}
}
function staticFile(req,res,u){let p=u.pathname==='/'?'/index.html':u.pathname;p=path.normalize(p).replace(/^([.][.][/\\])+/, '');const f=path.join(ROOT,p);if(!f.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(f);const ct={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':ct,'Cache-Control':ext==='.html'?'no-store':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'});res.end(b)})}
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){await api(req,res,u);return}staticFile(req,res,u)}).listen(PORT,'0.0.0.0',()=>console.log('Portfolio Pulse AI v5 production on http://localhost:'+PORT));
