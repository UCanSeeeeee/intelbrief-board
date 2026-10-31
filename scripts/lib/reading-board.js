const fs=require('node:fs');
const path=require('node:path');
const {context,POLICY}=require('./reading-period');
const key=value=>String(value).trim().toLowerCase();
const fileAt=root=>path.join(root,'data/reading-board.json');
function emptyBoard(){return {schemaVersion:1,updatedAt:null,asOf:null,events:[],applied:[],warnings:[]};}
function validateBoard(board){
  if(board.schemaVersion!==1||!Array.isArray(board.events)||!Array.isArray(board.applied)||!Array.isArray(board.warnings))throw new Error('待阅池结构无效');
  const ids=new Set();
  for(const item of board.events){
    if(!item.eventKey||ids.has(key(item.eventKey))||item.event?.eventKey!==item.eventKey||!['focus','insights'].includes(item.group)||!['active','served','retracted','superseded','resolved'].includes(item.state)||!Array.isArray(item.history))throw new Error('待阅事件结构或去重无效');
    ids.add(key(item.eventKey));
    for(const field of ['firstSeenAt','lastCheckedAt'])if(!Number.isFinite(Date.parse(item[field])))throw new Error('待阅时间无效');
    if(item.retainUntil&&!Number.isFinite(Date.parse(item.retainUntil)))throw new Error('待阅保留期限无效');
    if(!item.event.fact||!Array.isArray(item.event.sources)||!item.event.sources.length)throw new Error('待阅卡片缺少事实或证据');
  }
  for(const [group,limit]of [['focus',5],['insights',10]]){
    const selected=board.selected?.[group]||[];
    if(!Array.isArray(selected)||selected.length>limit||new Set(selected.map(key)).size!==selected.length||selected.some(id=>!board.events.some(e=>key(e.eventKey)===key(id)&&e.state==='active'&&e.group===group)))throw new Error('待阅精选无效');
  }
  return board;
}
function migrateBoard(previous) {
  const out=structuredClone(previous);
  if(out.policy===POLICY)return out;
  out.policy=POLICY;
  if(out.asOf)out.period=context(out.asOf);
  delete out.session;
  for(const item of out.events) {
    const period=context(item.retentionAnchor||item.firstSeenAt);
    item.readingDate=period.date;item.retainUntil=period.retainUntil;
    delete item.targetSession;
  }
  return validateBoard(out);
}
function readBoard(root){
  const board=migrateBoard(validateBoard(fs.existsSync(fileAt(root))?JSON.parse(fs.readFileSync(fileAt(root),'utf8')):emptyBoard()));
  const indexFile=path.join(root,'data/stock-briefs/index.json');
  if(!board.lastUsableCutoff&&fs.existsSync(indexFile)){
    const latest=JSON.parse(fs.readFileSync(indexFile,'utf8')).editions.filter(e=>e.status!=='failed'&&(!board.asOf||Date.parse(e.informationCutoff||e.scheduledFor)<=Date.parse(board.asOf))).sort((a,b)=>Date.parse(b.informationCutoff||b.scheduledFor)-Date.parse(a.informationCutoff||a.scheduledFor))[0];
    board.lastUsableCutoff=latest?.informationCutoff||latest?.scheduledFor||null;
  }
  return board;
}
function advance(previous,brief) {
  const out=migrateBoard(previous),signature=`${brief.id}:${brief.generatedAt}`;
  if(out.applied.includes(signature))return out;
  const informationCutoff=brief.informationCutoff||brief.scheduledFor;
  if(out.asOf&&Date.parse(informationCutoff)<Date.parse(out.asOf))return out; // archive backfill never rewinds live state
  const ctx=context(brief.generatedAt),cutoff=Date.parse(informationCutoff);
  const items=new Map(out.events.map(e=>[key(e.eventKey),e]));
  out.warnings=[];
  // Expiry only occurs on a usable new batch, never just because the clock advanced.
  if(brief.status!=='failed') {
    for(const item of items.values()) if(item.state==='active') {
      const target=context(item.retentionAnchor||item.firstSeenAt);
      item.readingDate=target.date;item.retainUntil=target.retainUntil;
      if(Date.parse(item.retainUntil)<=cutoff)item.state='served';
    }
    for(const group of ['focus','insights']) for(const [rank,event] of brief[group].entries()) {
      const id=key(event.eventKey),old=items.get(id);
      if(!old&&[...items.values()].some(item=>item.state==='active'&&item.event.sources.some(s=>event.sources.some(n=>n.postId===s.postId))))throw new Error('同一原帖跨期必须沿用事件键，不得重复占位');
      const material=!old||old.event.fact!==event.fact||event.sources.some(n=>!old.event.sources.some(s=>n.postId===s.postId));
      const record=old||{eventKey:event.eventKey,firstSeenAt:brief.generatedAt,firstEdition:brief.id,history:[]};
      if(old&&material)record.history.push({edition:record.lastEdition,event:record.event,changedAt:brief.generatedAt});
      record.group=group;record.event=structuredClone(event);record.rank=rank;record.lastEdition=brief.id;record.lastCheckedAt=brief.generatedAt;
      // Repeated old commentary cannot perpetually renew retention. A new substantiated fact can.
      if(!old||material) {record.state='active';record.retentionAnchor=brief.generatedAt;record.readingDate=ctx.date;record.retainUntil=ctx.retainUntil;record.lastMaterialAt=brief.generatedAt;record.lastMaterialEdition=brief.id;}
      record.lateDiscovery=Date.parse(event.sources[0].publishedAt)<cutoff-86400000;
      items.set(id,record);
    }
    for(const decision of brief.readingDecisions||[]) {
      const item=items.get(key(decision.eventKey));
      if(!item)throw new Error('待阅复核引用未知事件：'+decision.eventKey);
      if(!['keep','retracted','superseded','resolved'].includes(decision.action)||!decision.reason?.trim()||!/^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(decision.sourceUrl||''))throw new Error('待阅复核需有效动作、原因及原帖依据');
      const checked=Date.parse(decision.checkedAt);
      if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(decision.checkedAt||'')||!Number.isFinite(checked)||checked<Date.parse(item.firstSeenAt)||checked>Date.parse(brief.generatedAt))throw new Error('待阅复核时间无效');
      item.history.push({edition:brief.id,decision:structuredClone(decision)});
      item.review=structuredClone(decision);
      item.state=decision.action==='keep'?'active':decision.action;
      if(decision.action==='keep'){item.retentionAnchor=brief.generatedAt;item.readingDate=ctx.date;item.retainUntil=ctx.retainUntil;}
    }
  } else out.warnings.push('本期采集失败，保留上次待阅内容；不是本期新增或已重新核验。');
  out.events=[...items.values()];
  out.applied.push(signature);out.asOf=informationCutoff;out.updatedAt=brief.generatedAt;out.period=context(informationCutoff);out.lastStatus=brief.status;out.latestEditionId=brief.id;
  if(brief.status!=='failed')out.lastUsableCutoff=informationCutoff;
  out.coverage={status:brief.status==='failed'?'failed':brief.coverage?.status|| (brief.coverage?.gaps?.length?'partial':'complete')};
  out.selected={};
  for(const [group,limit]of [['focus',5],['insights',10]]) {
    const active=out.events.filter(e=>e.state==='active'&&e.group===group);
    const requested=brief.readingSelection?.[group];
    if(requested!==undefined) {
      if(!Array.isArray(requested)||requested.length>limit||new Set(requested.map(key)).size!==requested.length||requested.some(id=>!active.some(e=>key(e.eventKey)===key(id))))throw new Error('待阅精选编号、去重或数量无效');
      out.selected[group]=requested.map(id=>active.find(e=>key(e.eventKey)===key(id)).eventKey);
    } else {
      active.sort((a,b)=>Date.parse(b.lastCheckedAt)-Date.parse(a.lastCheckedAt)||a.rank-b.rank);
      out.selected[group]=active.slice(0,limit).map(e=>e.eventKey);
    }
  }
  return validateBoard(require('../../daily-records').capture(previous,out));
}
function writeBoard(root,board){const file=fileAt(root);fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(board,null,2)+'\n');fs.renameSync(temp,file);}
module.exports={emptyBoard,readBoard,advance,writeBoard,fileAt,validateBoard,migrateBoard};
