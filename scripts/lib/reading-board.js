const fs=require('node:fs');
const path=require('node:path');
const {context}=require('./trading-session');
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
function readBoard(root){return validateBoard(fs.existsSync(fileAt(root))?JSON.parse(fs.readFileSync(fileAt(root),'utf8')):emptyBoard());}
function advance(previous,brief,calendar) {
  const out=structuredClone(previous),signature=`${brief.id}:${brief.generatedAt}`;
  if(out.applied.includes(signature))return out;
  if(out.asOf&&Date.parse(brief.scheduledFor)<Date.parse(out.asOf))return out; // archive backfill never rewinds live state
  const ctx=context(brief.generatedAt,calendar),cutoff=Date.parse(brief.scheduledFor);
  const items=new Map(out.events.map(e=>[key(e.eventKey),e]));
  out.warnings=ctx.known?[]:[`${ctx.warning}；保留待阅信息，不自动到期清除，请核验官方日历。`];
  // A failed collection never clears the last usable reading pool, even after its session.
  if(brief.status!=='failed') {
    if(ctx.known) for(const item of items.values()) if(item.state==='active') {
      const target=context(item.retentionAnchor||item.firstSeenAt,calendar);
      if(target.known){item.targetSession=target.date;item.retainUntil=target.closeAt;}
      else if(!item.retainUntil){item.targetSession=ctx.date;item.retainUntil=ctx.closeAt;}
      if(target.known&&Date.parse(item.retainUntil)<=Date.parse(brief.generatedAt))item.state='served';
    }
    for(const group of ['focus','insights']) for(const [rank,event] of brief[group].entries()) {
      const id=key(event.eventKey),old=items.get(id);
      if(!old&&[...items.values()].some(item=>item.state==='active'&&item.event.sources.some(s=>event.sources.some(n=>n.postId===s.postId))))throw new Error('同一原帖跨期必须沿用事件键，不得重复占位');
      const material=!old||old.event.fact!==event.fact||event.sources.some(n=>!old.event.sources.some(s=>n.postId===s.postId));
      const record=old||{eventKey:event.eventKey,firstSeenAt:brief.generatedAt,firstEdition:brief.id,history:[]};
      if(old&&material)record.history.push({edition:record.lastEdition,event:record.event,changedAt:brief.generatedAt});
      record.group=group;record.event=structuredClone(event);record.rank=rank;record.lastEdition=brief.id;record.lastCheckedAt=brief.generatedAt;
      // Repeated old commentary cannot perpetually renew retention. A new substantiated fact can.
      if(!old||material) {record.state='active';record.retentionAnchor=brief.generatedAt;record.targetSession=ctx.known?ctx.date:null;record.retainUntil=ctx.known?ctx.closeAt:null;}
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
      if(decision.action==='keep'){item.retentionAnchor=brief.generatedAt;item.targetSession=ctx.known?ctx.date:null;item.retainUntil=ctx.known?ctx.closeAt:null;}
    }
  } else out.warnings.push('本期采集失败，保留上次待阅内容；不是本期新增或已重新核验。');
  out.events=[...items.values()];
  out.applied.push(signature);out.asOf=brief.scheduledFor;out.updatedAt=brief.generatedAt;out.session=ctx;out.lastStatus=brief.status;
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
  return validateBoard(out);
}
function writeBoard(root,board){const file=fileAt(root);fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(board,null,2)+'\n');fs.renameSync(temp,file);}
module.exports={emptyBoard,readBoard,advance,writeBoard,fileAt,validateBoard};
