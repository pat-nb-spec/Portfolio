const {doSearch}=require('./_providers'); const send=require('./_send');
module.exports=async(req,res)=>{try{const q=String((req.query&&req.query.q)||'').trim();const items=await doSearch(q);send(res,200,{ok:true,items});}catch(e){send(res,503,{ok:false,error:e.message});}};
