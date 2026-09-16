const {KEYS}=require('./_providers'); const send=require('./_send');
module.exports=async(req,res)=>send(res,200,{ok:true,providers:{twelve:!!KEYS.twelve,finnhub:!!KEYS.finnhub,alpha:!!KEYS.alpha},runtime:'serverless'});
