const {doHistory}=require('./_providers'); const send=require('./_send');
module.exports=async(req,res)=>{try{const s=String((req.query&&req.query.symbol)||'').trim();const r=String((req.query&&req.query.range)||'1Y');const history=await doHistory(s,r);send(res,200,{ok:true,history});}catch(e){send(res,503,{ok:false,error:e.message});}};
