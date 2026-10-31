// Collection checkpoints describe executed, bounded queries, not exhaustive X coverage.
const fs=require('node:fs');
const path=require('node:path');
const DAY=86400000;
const ROOT=path.resolve(__dirname,'../..');
const at=root=>path.join(root,'data/collection-progress.json');
const iso=value=>{if(typeof value!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('采集时间必须带时区');return new Date(value).toISOString();};
function units(root=ROOT){
  const news=['market-focus','semiconductors','power','ai-adoption','capital-cost','geopolitics','market-structure'].map(id=>({id:'news:'+id,page:'news',object:id}));
  return news.concat(['people','tickers','ai'].flatMap(page=>{
    const name=page==='tickers'?'ticker':page;
    const cfg=JSON.parse(fs.readFileSync(path.join(root,'config/'+name+'-intelligence.json'),'utf8'));
    return cfg.tabs.flatMap(tab=>[{id:page+':'+tab.id,page,object:tab.id,label:tab.label},...(page==='tickers'&&cfg.hotspotPolicy?.enabled?[{id:page+':'+tab.id+':hotspots',page,object:tab.id+':hotspots',tabId:tab.id,kind:'hotspots',collectionMode:cfg.hotspotPolicy.collectionMode,label:tab.label+' X热点'}]:[])]);
  }));
}
function read(root=ROOT){return fs.existsSync(at(root))?JSON.parse(fs.readFileSync(at(root),'utf8')):{schemaVersion:1,units:{},pending:[],receipts:[]};}
function plan(root,cutoff,page=null,state=read(root)){
  const end=iso(cutoff),limit=Date.parse(end);
  return units(root).filter(u=>!page||u.page===page).map(unit=>{
    const previous=state.units[unit.id],anchor=previous?.through||previous?.pendingFrom,start=anchor?iso(anchor):new Date(limit-DAY).toISOString();
    if(unit.collectionMode==='incremental-ranking')return {...unit,start,end,cutoff:end,needsQuery:Date.parse(start)<limit,bootstrap:!previous?.through,catchingUp:false,pending:[]};
    const stop=new Date(Math.min(limit,Date.parse(start)+14*DAY)).toISOString();
    return {...unit,start,end:stop,cutoff:end,needsQuery:Date.parse(start)<limit,bootstrap:!previous?.through,catchingUp:Date.parse(stop)<limit,pending:(state.pending||[]).filter(p=>p.unit===unit.id&&p.status==='pending')};
  });
}
function evidence(root,relative){
  if(typeof relative!=='string'||!/^data\/collection-(?:runs|results)\/[\w.-]+\.json$/.test(relative))throw new Error('须引用已落盘的本项目采集审计或结果');
  const file=path.join(root,relative);
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
function apply(root,input,now=new Date()){
  if(!input||!/^[-\w]+$/.test(input.runId||'')||!Array.isArray(input.results))throw new Error('采集进度缺少运行编号或结果');
  const cutoff=iso(input.cutoff);
  if(Date.parse(cutoff)>+now)throw new Error('不能推进未来采集截止');
  const state=structuredClone(read(root)),configured=new Map(units(root).map(u=>[u.id,u])),allowed=new Set(configured.keys()),seen=new Set();
  state.receipts=state.receipts||[];state.pending=state.pending||[];
  for(const result of input.results){
    if(!allowed.has(result.unit)||seen.has(result.unit))throw new Error('未知或重复采集对象');seen.add(result.unit);
    const start=iso(result.start),end=iso(result.end);
    if(!(Date.parse(start)<Date.parse(end))||Date.parse(end)>Date.parse(cutoff))throw new Error('采集进度区间无效');
    if(!['searched','no-result','failed'].includes(result.status)||!result.note?.trim())throw new Error('采集执行结果无效');
    if(result.status!=='failed'&&(!Array.isArray(result.queries)||!result.queries.length||!result.queries.every(q=>typeof q==='string'&&q.trim())))throw new Error('成功采集必须保留实际查询');
    const proof=evidence(root,result.evidenceFile);
    if(proof.id!==input.runId||Date.parse(proof.cutoff)!==Date.parse(cutoff))throw new Error('采集证据的运行编号或截止不一致');
    if(!proof.collectionResults?.some(r=>r.unit===result.unit&&Date.parse(r.start)===Date.parse(start)&&Date.parse(r.end)===Date.parse(end)&&r.status===result.status&&JSON.stringify(r.queries||[])===JSON.stringify(result.queries||[])))throw new Error('审计中未保存该对象的实际查询执行结果');
    const receipt=input.runId+':'+result.unit+':'+start+':'+end;
    if(state.receipts.includes(receipt))continue;
    const old=state.units[result.unit];
    if(old?.through&&Date.parse(old.through)>Date.parse(end))throw new Error('禁止回退采集进度');
    const anchor=old?.through||old?.pendingFrom;
    if(anchor&&Date.parse(start)!==Date.parse(anchor))throw new Error('必须严格接续该对象上次成功截止，不能跨过缺口或重复宽搜');
    if(configured.get(result.unit).kind==='hotspots'&&result.status!=='failed'&&Date.parse(end)!==Date.parse(cutoff))throw new Error('热点成功榜必须覆盖本次实际截止');
    const page=result.unit.split(':')[0],batch=proof.batches?.find(b=>b.page===page);
    const completeOutput=result.unit.endsWith(':hotspots')?Array.isArray(batch?.output?.hotspots):page==='news'?Array.isArray(batch?.output?.focus)&&Array.isArray(batch?.output?.insights):Array.isArray(batch?.output?.items);
    if(result.status!=='failed'&&!completeOutput)throw new Error('成功进度必须先保存该批完整待发布结果；只有计划或条数不够');
    if(configured.get(result.unit).kind==='hotspots'&&result.status!=='failed'&&!batch.output.hotspotTabs?.some(t=>t.id===configured.get(result.unit).tabId&&(t.status==='complete'||t.status==='partial'&&t.windowComplete===true)))throw new Error('热点成功记录必须证明该股整个时间窗已查询');
    state.units[result.unit]={...old,lastAttemptAt:now.toISOString(),lastAttemptEnd:end,lastAttemptStatus:result.status,note:result.note};
    if(result.status!=='failed')Object.assign(state.units[result.unit],{through:end,lastSuccessAt:now.toISOString(),runId:input.runId,evidenceFile:result.evidenceFile});
    else state.units[result.unit].pendingFrom=anchor||start;
    if(result.status!=='failed')delete state.units[result.unit].pendingFrom;
    if(result.status!=='failed')state.receipts.push(receipt);
  }
  for(const p of input.pending||[]){
    if(!allowed.has(p.unit)||!p.key||!['pending','resolved','excluded'].includes(p.status)||!p.reason?.trim())throw new Error('待核候选记录无效');
    const index=state.pending.findIndex(old=>old.unit===p.unit&&old.key===p.key);
    const item={...p,updatedAt:now.toISOString(),runId:input.runId};
    if(index<0)state.pending.push(item);else state.pending[index]=item;
  }
  state.updatedAt=now.toISOString();
  return state;
}
function write(root,state){const file=at(root);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
function initialize(root,auditFile,now=new Date()){
  if(fs.existsSync(at(root)))throw new Error('进度已存在，禁止重复初始化');
  const audit=evidence(root,auditFile),cutoff=iso(audit.cutoff);
  if(Date.parse(cutoff)>+now)throw new Error('不能从未来审计初始化');
  const state={schemaVersion:1,updatedAt:now.toISOString(),migration:{auditFile,cutoff,note:'从已保存且各采集子任务完成的执行审计建立切换点；不改写旧partial记录，不声称X全量覆盖。'},units:{},pending:[],receipts:[]};
  for(const unit of units(root)){
    const batch=audit.batches.find(b=>b.page===unit.page);
    if(!batch?.queries?.length||!['discovery','source-verification','counter-evidence'].every(id=>batch.subtasks?.some(s=>s.id===id&&s.status==='complete')))throw new Error('历史审计不能证明该对象所属批次执行完成：'+unit.id);
    if(unit.page!=='news'&&!(batch.checklistResults||batch.checklist)?.some(c=>c.item===unit.object))throw new Error('历史审计缺少对象清单：'+unit.id);
    state.units[unit.id]={through:cutoff,runId:audit.id,evidenceFile:auditFile,note:'迁移切换点：既定查询已执行；证据不足或无合格新增不等于请求失败。'};
  }
  return state;
}
module.exports={ROOT,units,read,plan,apply,write,initialize};
