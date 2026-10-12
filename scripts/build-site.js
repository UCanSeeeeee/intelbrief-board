#!/usr/bin/env node
// Only public assets enter the deployment. Runtime credentials/logs never live here.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), output=path.join(root,'dist');
fs.mkdirSync(output,{recursive:true});
for(const entry of fs.readdirSync(output)) fs.rmSync(path.join(output,entry),{recursive:true,force:true});
for(const file of ['index.html','people.html','tickers.html','ai.html','crypto.html','earnings.html','macro.html','app.js','briefs.js','people.js','tickers.js','ai.js','crypto.js','earnings.js','macro.js','updates.js','styles.css','_worker.js','_routes.json']) fs.copyFileSync(path.join(root,file),path.join(output,file));
for(const file of ['config/stock-brief.json','config/people-intelligence.json','config/ticker-intelligence.json','config/ai-intelligence.json','config/crypto-intelligence.json','config/earnings-calendar.json','config/company-blurbs.json','config/macro-events.json','sources/x-sources.json','data/x-intelligence.json','data/people-intelligence.json','data/ticker-intelligence.json','data/ai-intelligence.json','data/crypto-intelligence.json','data/earnings-calendar.json','data/macro-events.json','server/updates.mjs']) {
  fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(output,file));
}
fs.copyFileSync(path.join(root,'calendar-time.js'),path.join(output,'calendar-time.js'));
if(fs.existsSync(path.join(root,'data/reading-board.json')))fs.copyFileSync(path.join(root,'data/reading-board.json'),path.join(output,'data/reading-board.json'));
for(const dir of ['assets/fluent','data/stock-briefs','data/update-receipts']) if(fs.existsSync(path.join(root,dir))) fs.cpSync(path.join(root,dir),path.join(output,dir),{recursive:true});
// People publication verification includes the archived source and per-account checks.
for(const file of ['data/raw/x-posts.json','data/people-checks.json']) if(fs.existsSync(path.join(root,file))) {
  fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(output,file));
}
console.log('Public website built in dist; evidence timestamps unchanged.');
