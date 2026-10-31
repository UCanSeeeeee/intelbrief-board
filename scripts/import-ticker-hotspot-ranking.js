#!/usr/bin/env node
// Convert a saved, reviewed Grok ranking into the existing publication contract.
// Never searches, invents engagement, or publishes by itself.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const sourcePath=process.argv[2],auditFile=process.argv[3],outputPath=process.argv[4];
if(!sourcePath||!auditFile||!outputPath)throw new Error('用法：import-ticker-hotspot-ranking.js SOURCE.json AUDIT.json OUTPUT.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
const cfg=JSON.parse(fs.readFileSync(path.join(root,'config/ticker-intelligence.json'),'utf8'));
const units=require('./lib/collection-progress').plan(root,source.cutoff,'tickers').filter(u=>u.kind==='hotspots');
const {replaceAliases}=require('./lib/person-names');
if(source.pendingTabs?.length)throw new Error('仍有未处理对象，保留断点不得发布');
if(Date.parse(source.cutoff)!==Date.parse(audit.cutoff))throw new Error('来源与审计截止不一致');
const allowed=new Set(cfg.tabs.map(t=>t.id)),seen=new Set(),hotspots=[],hotspotTabs=[];
for(const tab of source.tabs){
  if(!allowed.has(tab.id)||seen.has(tab.id))throw new Error('未知或重复股票');seen.add(tab.id);
  if(!Array.isArray(tab.rows)||!tab.query||!['complete','partial','failed'].includes(tab.status))throw new Error('缺少查询或执行状态');
  const unit=units.find(u=>u.tabId===tab.id);
  if(!unit||Date.parse(tab.windowStart)!==Date.parse(unit.start)||Date.parse(tab.windowEnd)!==Date.parse(unit.end))throw new Error('该股实际检索窗口与成功进度不一致：'+tab.id);
  const collectionPath=tab.collectionPath||source.collectionPath;
  if(!['grok-app','grok-web'].includes(collectionPath))throw new Error('每只股票须标明实际采集路径 grok-app 或 grok-web');
  const unranked=[];
  for(const row of tab.rows){
    if(row.length!==source.columns.length)throw new Error('来源列数不一致');
    const p=Object.fromEntries(source.columns.map((k,i)=>[k,row[i]]));
    if(!Number.isInteger(p.views)||p.views<0){unranked.push(p);continue;}
    hotspots.push({tabId:tab.id,eventKey:`x-${tab.id}-${p.postId}`,author:p.author,
      url:`https://x.com/${p.author}/status/${p.postId}`,publishedAt:p.publishedAt,
      title:replaceAliases(p.title),fact:replaceAliases(p.summary),originalText:p.originalText,
      originalTextIsExcerpt:true,excerptNote:'Grok返回的原文摘录；未展示部分不补写。',
      sourceNature:'non-official',verification:'collector-report',eventTime:null,eventTimeNote:'实际事件时间未知',
      engagement:{views:p.views,likes:p.likes,reposts:p.reposts,replies:p.replies,capturedAt:tab.capturedAt||source.capturedAt,source:collectionPath==='grok-app'?'grok-app-observed':'grok-web-observed'}});
  }
  if(unranked.length)tab.unranked=unranked;
  hotspotTabs.push({id:tab.id,status:tab.status==='failed'?'failed':unranked.length?'partial':tab.status,windowComplete:tab.windowComplete===true,queries:[tab.query,...(tab.followups||[])],note:tab.note||'Grok直接返回浏览量前五；仅已检索样本，普通观点未升格为事实。'});
}
if(seen.size!==allowed.size)throw new Error('未覆盖全部配置股票');
const relative=path.relative(root,path.resolve(auditFile)).split(path.sep).join('/');
const output={cutoff:source.cutoff,auditFile:relative,conversationUrl:source.conversationUrl,
  hotspotSnapshot:true,
  observationNote:source.provenance,toolEvidence:source.toolEvidence,excludedCandidates:source.excludedCandidates||[],hotspotTabs,hotspots,
  hotspotCollectionUnits:units};
audit.batches[0].sourceFile=path.relative(root,path.resolve(sourcePath)).split(path.sep).join('/');
audit.batches[0].output={hotspots,hotspotTabs};
audit.batches[0].unrankedCandidates=source.tabs.flatMap(t=>(t.unranked||[]).map(p=>({tabId:t.id,...p})));
fs.writeFileSync(auditFile,JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(`已转换${hotspots.length}条已保存帖子；未搜索、未发布、未推进游标。`);
