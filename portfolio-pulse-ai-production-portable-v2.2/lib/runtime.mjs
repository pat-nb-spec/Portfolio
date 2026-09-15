export class TTLCache {
  constructor(){ this.map=new Map(); }
  get(key){ const x=this.map.get(key); if(!x) return null; if(Date.now()>x.exp){this.map.delete(key);return null;} return x.value; }
  set(key,value,ttlMs){ this.map.set(key,{value,exp:Date.now()+ttlMs}); }
  size(){ return this.map.size; }
}

export class CircuitBreaker {
  constructor({threshold=3,cooldownMs=60_000}={}){this.threshold=threshold;this.cooldownMs=cooldownMs;this.state=new Map();}
  canTry(name){ const s=this.state.get(name); return !s || !s.openUntil || Date.now()>=s.openUntil; }
  success(name){ this.state.set(name,{fails:0,openUntil:0,lastSuccess:new Date().toISOString()}); }
  fail(name){ const s=this.state.get(name)||{fails:0,openUntil:0}; s.fails+=1; s.lastFailure=new Date().toISOString(); if(s.fails>=this.threshold)s.openUntil=Date.now()+this.cooldownMs; this.state.set(name,s); }
  status(name){ const s=this.state.get(name)||{fails:0,openUntil:0}; return {...s,open:Boolean(s.openUntil&&Date.now()<s.openUntil)}; }
}

export async function fetchJson(url,{headers={},timeoutMs=5000}={}){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{ const r=await fetch(url,{headers,signal:ctrl.signal}); const text=await r.text(); let body; try{body=JSON.parse(text)}catch{body={raw:text}}; if(!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`),{status:r.status,body}); return body; }
  finally{clearTimeout(t)}
}
