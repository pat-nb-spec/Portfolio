const {doQuote}=require('./_providers'); const send=require('./_send');
module.exports=async(req,res)=>{try{const s=String((req.query&&req.query.symbol)||'').trim();const quote=await doQuote(s);send(res,200,{ok:true,quote});}catch(e){send(res,503,{ok:false,error:e.message});}};
