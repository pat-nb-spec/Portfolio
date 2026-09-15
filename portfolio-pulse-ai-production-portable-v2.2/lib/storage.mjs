import fs from 'node:fs';
import path from 'node:path';

export class AtomicJsonStore {
  constructor(file, fallback, {backupDir, maxBackups=20}={}) {
    this.file=file; this.fallback=fallback; this.backupDir=backupDir; this.maxBackups=maxBackups;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    if(backupDir) fs.mkdirSync(backupDir,{recursive:true});
  }
  load(){
    if(!fs.existsSync(this.file)) this.save(structuredClone(this.fallback), {backup:false});
    try { return JSON.parse(fs.readFileSync(this.file,'utf8')); }
    catch { return structuredClone(this.fallback); }
  }
  save(data,{backup=true}={}){
    const tmp=this.file+'.tmp-'+process.pid+'-'+Date.now();
    if(backup && fs.existsSync(this.file) && this.backupDir){
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');
      try{ fs.copyFileSync(this.file,path.join(this.backupDir,`state-${stamp}.json`)); this.prune(); }catch{}
    }
    fs.writeFileSync(tmp,JSON.stringify(data,null,2),{encoding:'utf8',mode:0o600});
    fs.renameSync(tmp,this.file);
  }
  prune(){
    if(!this.backupDir) return;
    const files=fs.readdirSync(this.backupDir).filter(x=>x.endsWith('.json')).sort().reverse();
    for(const f of files.slice(this.maxBackups)){ try{fs.unlinkSync(path.join(this.backupDir,f));}catch{} }
  }
}
