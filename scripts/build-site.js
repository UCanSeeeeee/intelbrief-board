#!/usr/bin/env node
// Only public assets enter the deployment. Runtime credentials/logs never live here.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), output=path.join(root,'dist');
fs.mkdirSync(output,{recursive:true});
for(const entry of fs.readdirSync(output)) fs.rmSync(path.join(output,entry),{recursive:true,force:true});
for(const file of ['index.html','people.html','stocks.html','sources.html','app.js','briefs.js','people.js','updates.js','styles.css','_worker.js','_routes.json']) fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const file of ['config/stock-brief.json','config/people-intelligence.json','sources/x-sources.json','data/x-intelligence.json','data/people-intelligence.json','server/updates.mjs']) {
  fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(output,file));
}
for(const dir of ['data/stock-briefs','data/update-receipts']) if(fs.existsSync(path.join(root,dir))) fs.cpSync(path.join(root,dir),path.join(output,dir),{recursive:true});
// People publication verification includes the archived source and per-account checks.
for(const file of ['data/raw/x-posts.json','data/people-checks.json']) if(fs.existsSync(path.join(root,file))) {
  fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(output,file));
}
console.log('Public website built in dist; evidence timestamps unchanged.');
