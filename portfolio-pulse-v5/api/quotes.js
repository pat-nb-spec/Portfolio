const {doQuote}=require('./_providers');
const send=require('./_send');

async function pooled(items,limit,fn){
  const out=new Array(items.length); let next=0;
  async function worker(){
    while(true){const i=next++; if(i>=items.length)break; try{out[i]=await fn(items[i])}catch(e){out[i]={symbol:items[i],error:e.message}}}
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

module.exports=async(req,res)=>{
  try{
    const raw=String((req.query&&req.query.symbols)||'');
    const symbols=[...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,50);
    if(!symbols.length) return send(res,400,{ok:false,error:'Missing symbols'});
    const results=await pooled(symbols,4,doQuote);
    const quotes=results.filter(x=>x&&!x.error);
    const errors=results.filter(x=>x&&x.error);
    send(res,200,{ok:true,quotes,errors,syncedAt:new Date().toISOString()});
  }catch(e){send(res,503,{ok:false,error:e.message})}
};
