#!/usr/bin/env node
// Actual publication from saved collection evidence, not a test or synthetic data generator.
const fs=require('node:fs'),path=require('node:path');
const {mergeHotspots}=require('./lib/ticker-hotspots');
const root=path.resolve(__dirname,'..'),inputPath=process.argv[2];
if(!inputPath)throw new Error('用法：node scripts/publish-ticker-hotspots.js <已保存的采集结果JSON>');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const input=read(path.resolve(inputPath));
const file=path.join(root,'data/ticker-intelligence.json');
const data=mergeHotspots(input,read(path.join(root,'config/ticker-intelligence.json')),read(file),input.cutoff);
if(input.auditFile){
  if(!/^data\/collection-runs\/[\w.-]+\.json$/.test(input.auditFile))throw new Error('审计须位于本项目采集记录目录');
  const auditPath=path.join(root,input.auditFile),audit=read(auditPath);
  if(Date.parse(audit.cutoff)!==Date.parse(input.cutoff))throw new Error('审计截止与待发布结果不一致');
  const progress=require('./lib/collection-progress');
  const units=progress.plan(root,input.cutoff,'tickers').filter(u=>u.kind==='hotspots'&&u.needsQuery);
  if(!units.length){
    fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);
    console.log('热点窗口已记录；保留原审计和游标，仅幂等合并现有载荷。');process.exit(0);
  }
  const reports=new Map(input.hotspotTabs.map(r=>[r.id,r]));
  audit.status='complete';audit.finishedAt=new Date().toISOString();audit.conversationUrl=input.conversationUrl;
  audit.sourceObservation=input.observationNote;
  const batch=audit.batches.find(b=>b.page==='tickers');
  batch.output={hotspots:data.hotspots,hotspotTabs:input.hotspotTabs};
  batch.checklist=batch.checklist.map(c=>({...c,status:reports.get(c.tabId)?.status==='failed'?'insufficient':'covered',note:reports.get(c.tabId)?.note}));
  batch.excludedCandidates=input.excludedCandidates||[];
  batch.toolEvidence='浏览器工作过程可见三股首轮10帖及5帖补取；其余四股首轮各10帖及产业主题补查各10帖的“已搜索𝕏”工具记录；没有普通网页检索。';
  audit.collectionResults=units.map(u=>({unit:u.id,start:u.start,end:u.end,status:reports.get(u.tabId).status==='failed'?'failed':'searched',queries:reports.get(u.tabId).queries,note:reports.get(u.tabId).note,evidenceFile:input.auditFile}));
  fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');
  const state=progress.apply(root,{runId:audit.id,cutoff:input.cutoff,results:audit.collectionResults});
  // Save the public artifact before advancing checkpoints; a failure can be retried idempotently.
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);
  progress.write(root,state);
  console.log(`已保存 ${data.hotspots.length} 条独立热点及各股审计/游标；事实区和其采集截止未改写。`);
  process.exit(0);
}
fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);
console.log(`已保存 ${data.hotspots.length} 条独立热点；事实区和其采集截止未改写。`);
