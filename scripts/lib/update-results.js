const {mergePosts,sha256,canonicalPostUrl}=require('./x-data');
const {prepareBrief}=require('./stock-brief');
const {windowStart,beijingIso,displayWindow}=require('./windows');
const requireValue=(ok,message)=> {if(!ok) throw new Error(message);};
function date(value) { return typeof value==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)); }
function prepareNews(input,job,start,sources,now=new Date(),carried=[]) {
  requireValue(input && typeof input==='object','采集器未返回简报');
  for(const event of [...(input.focus||[]),...(input.insights||[])]) for(const source of event.sources||[]) requireValue(source.verification==='collector-report','Grok来源必须标为采集器转述，不能声称独立直读');
  const scheduledFor=job.trigger_type==='scheduled' ? beijingIso(job.cutoff) : job.cutoff;
  return prepareBrief({...input,trigger:job.trigger_type,requestId:job.id,scheduledFor,windowStart:start,...displayWindow(job.cutoff),carriedOver:carried||[]},{now,sources});
}
function preparePeople(input,registry,raw,previous,cutoff,now=new Date()) {
  const people=registry.accounts.filter(a=>a.enabled&&a.category==='people');
  const allowed=new Map(people.map(a=>[a.username.toLowerCase(),a]));
  requireValue(Array.isArray(input?.accounts) && Array.isArray(input?.posts),'人物采集缺少账号结果或原帖');
  const accounts=new Map();
  for(const account of input.accounts) {
    const name=String(account.username).toLowerCase();
    requireValue(allowed.has(name)&&!accounts.has(name),'人物采集包含未登记或重复账号');
    requireValue(['complete','partial','failed'].includes(account.status),'账号采集状态无效');
    requireValue(typeof account.note==='string'&&account.note.trim(),'账号缺少采集范围或失败说明');
    requireValue(date(account.checkedAt)&&Date.parse(account.checkedAt)<=+now&&Date.parse(account.checkedAt)>=Date.parse(cutoff),'账号检查时间无效');
    accounts.set(name,account);
  }
  requireValue(accounts.size===allowed.size,'必须报告每个已登记人物的检查结果');
  const ids=new Set();
  const incoming=input.posts.map(post=> {
    const name=String(post.author?.username).toLowerCase(),source=allowed.get(name);
    requireValue(source&&accounts.get(name)?.status!=='failed','原帖不属于本次成功检查的已登记人物');
    requireValue(typeof post.id==='string'&&/^\d+$/.test(post.id)&&!ids.has(post.id),'原帖编号无效或重复'); ids.add(post.id);
    requireValue(post.url===canonicalPostUrl(source.username,post.id)||post.url===canonicalPostUrl(name,post.id),'原帖地址、作者和编号不一致');
    requireValue(date(post.createdAt)&&Date.parse(post.createdAt)<=Date.parse(cutoff),'原帖缺少准确时间或晚于截止');
    requireValue(typeof post.text==='string'&&post.text.trim(),'缺少原帖完整正文');
    requireValue(post.verification==='collector-report','人物原帖必须标明Grok返回、未独立直读');
    requireValue(typeof post.verificationNote==='string'&&post.verificationNote.trim(),'缺少原帖读取证据说明');
    const start=previous.accounts?.[name]?.lastSuccessAt;
    const lower=Math.max(start ? Date.parse(start)-3600000 : 0,Date.parse(cutoff)-168*3600000);
    requireValue(Date.parse(post.createdAt)>=lower,'原帖超出本次人物采集窗口');
    return {id:post.id,url:canonicalPostUrl(source.username,post.id),author:{username:source.username,name:source.displayName},createdAt:post.createdAt,text:post.text,
      capturedAt:now.toISOString(),firstCapturedAt:now.toISOString(),category:'people',topics:source.topics||[],captureMethod:input.collectionPath||'grok-app',verification:'collector-report',verificationNote:post.verificationNote,contentHash:sha256(`${post.id}\n${post.text}`)};
  });
  const byId=new Map(raw.posts.map(p=>[p.id,p]));
  const added=incoming.filter(p=>!byId.has(p.id)).length;
  const changed=incoming.filter(p=>byId.has(p.id)&&byId.get(p.id).text!==p.text).length;
  const checkpoints=structuredClone(previous.accounts||{});
  for(const [name,account] of accounts) checkpoints[name]={...checkpoints[name],lastAttemptAt:account.checkedAt,status:account.status,note:account.note,...(account.status==='complete'?{lastSuccessAt:cutoff}:{})};
  const failed=[...accounts.values()].filter(a=>a.status!=='complete');
  const status=failed.length===people.length && !incoming.length && failed.every(a=>a.status==='failed') && people.length ? 'failed' : failed.length ? 'partial' : added||changed ? 'complete':'unchanged';
  return {posts:mergePosts(raw.posts,incoming),checkpoints:{accounts:checkpoints},status,added,changed,failures:failed.map(a=>({username:a.username,note:a.note})),message:status==='failed'?'所有人物账号采集失败':`新增 ${added} 条，修订 ${changed} 条${failed.length?`；${failed.length} 个账号未完整检查：${failed.map(a=>'@'+a.username+' '+a.note).join('；')}`:''}`};
}
function prepareTabbedIntelligence(input,config,existing,cutoff,now=new Date(),kind='人物情报') {
  requireValue(input&&typeof input==='object',`${kind}采集器没有返回结果`);
  requireValue(date(input.checkedAt)&&Date.parse(input.checkedAt)>=Date.parse(cutoff)&&Date.parse(input.checkedAt)<=+now,`${kind}检查时间无效`);
  const configured=Array.isArray(config?.tabs)?config.tabs:[];
  requireValue(configured.length>0,`${kind}没有配置顶部Tab`);
  const allowed=new Map(configured.map(tab=>[tab.id,tab]));
  requireValue(Array.isArray(input.tabs)&&Array.isArray(input.items),`${kind}缺少Tab检查结果或事件`);
  const reports=new Map();
  for(const report of input.tabs) {
    requireValue(allowed.has(report.id)&&!reports.has(report.id),`${kind}包含未知或重复Tab`);
    requireValue(['complete','partial','failed'].includes(report.status),`${kind}Tab状态无效`);
    requireValue(typeof report.note==='string'&&report.note.trim(),`${kind}Tab缺少查询范围或缺口说明`);
    reports.set(report.id,{id:report.id,status:report.status,note:report.note});
  }
  requireValue(reports.size===allowed.size,`必须报告每个${kind}Tab的检查结果`);
  const dayMs=86400000;
  const windowDays=tab=>{
    const latest=Number(tab.latestWindowDays);
    const weekly=Number(tab.weeklyWindowDays);
    requireValue(Number.isFinite(latest)&&latest>0&&Number.isFinite(weekly)&&weekly>0,`${tab.label}缺少有效窗口天数`);
    return {latest,weekly};
  };
  const maxWindowDays=Math.max(...configured.map(tab=>Math.max(windowDays(tab).latest,windowDays(tab).weekly)));
  const keys=new Set(),urls=new Set();
  const items=input.items.map(item=> {
    requireValue(typeof item.eventKey==='string'&&item.eventKey.trim()&&!keys.has(item.eventKey),`${kind}事件键无效或重复`);keys.add(item.eventKey);
    requireValue(Array.isArray(item.tabIds)&&item.tabIds.length>0&&new Set(item.tabIds).size===item.tabIds.length&&item.tabIds.every(id=>allowed.has(id)&&reports.get(id).status!=='failed'),`${kind}事件包含无效Tab`);
    requireValue(typeof item.url==='string'&&/^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(item.url)&&!urls.has(item.url),`${kind}缺少真实或唯一X原帖`);urls.add(item.url);
    requireValue(date(item.publishedAt)&&Date.parse(item.publishedAt)<=Date.parse(cutoff)&&Date.parse(item.publishedAt)>=Date.parse(cutoff)-maxWindowDays*dayMs,`${kind}原帖时间超出配置滚动窗口`);
    for(const field of ['title','fact','whyItMatters','counterCase','author']) requireValue(typeof item[field]==='string'&&item[field].trim(),`${kind}缺少${field}`);
    requireValue(item.verification==='collector-report',`${kind}必须标明Grok返回、未独立直读`);
    requireValue(['must-read','watch'].includes(item.tier),`${kind}价值层级无效`);
    requireValue(Array.isArray(item.affected),`${kind}缺少影响对象`);
    const ranks=item.weeklyRanks||{};
    for(const [tabId,rank] of Object.entries(ranks)) requireValue(item.tabIds.includes(tabId)&&Number.isInteger(rank)&&rank>=1&&rank<=allowed.get(tabId).weeklyLimit,`${kind}周榜排名无效`);
    return {eventKey:item.eventKey.trim(),tabIds:item.tabIds,title:item.title.trim(),fact:item.fact.trim(),whyItMatters:item.whyItMatters.trim(),counterCase:item.counterCase.trim(),affected:item.affected.map(String),author:item.author.trim(),publishedAt:item.publishedAt,url:item.url,verification:'collector-report',tier:item.tier,weeklyRanks:ranks};
  });
  for(const tab of configured) {
    const {latest,weekly}=windowDays(tab);
    const tabItems=items.filter(item=>item.tabIds.includes(tab.id));
    requireValue(tabItems.filter(item=>Date.parse(item.publishedAt)>=Date.parse(cutoff)-latest*dayMs).length<=tab.latestLimit,`${tab.label}的近${latest}天条目超过上限`);
    for(const item of tabItems) {
      const hasRank=item.weeklyRanks[tab.id]!=null;
      const inWeekly=Date.parse(item.publishedAt)>=Date.parse(cutoff)-weekly*dayMs;
      const inLatest=Date.parse(item.publishedAt)>=Date.parse(cutoff)-latest*dayMs;
      requireValue(inLatest||(hasRank&&inWeekly),`${tab.label}含有超出该Tab窗口的条目`);
    }
    const ranked=tabItems.filter(item=>item.weeklyRanks[tab.id]!=null);
    requireValue(ranked.every(item=>Date.parse(item.publishedAt)>=Date.parse(cutoff)-weekly*dayMs),`${tab.label}的重点榜超出窗口`);
    requireValue(ranked.length<=tab.weeklyLimit&&new Set(ranked.map(item=>item.weeklyRanks[tab.id])).size===ranked.length,`${tab.label}的重点榜超过上限或排名重复`);
  }
  const failures=[...reports.values()].filter(report=>report.status!=='complete');
  const allFailed=failures.length===configured.length&&failures.every(report=>report.status==='failed');
  const stableItems=items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const same=JSON.stringify(stableItems)===JSON.stringify(existing?.items||[]);
  const status=allFailed?'failed':failures.length?'partial':same?'unchanged':'complete';
  const data={schemaVersion:1,updatedAt:now.toISOString(),cutoff,source:'X only',status,coverage:{tabs:[...reports.values()]},items:stableItems};
  const message=status==='failed'?`所有${kind}Tab采集失败`:`${items.length} 件入选事件${failures.length?`；${failures.length} 个Tab未完整检查`:'；全部Tab已完整检查'}`;
  return {data,status,message,failures};
}
function preparePeopleIntelligence(input,config,existing,cutoff,now=new Date()){return prepareTabbedIntelligence(input,config,existing,cutoff,now,'人物情报');}
function prepareTickerIntelligence(input,config,existing,cutoff,now=new Date()){return prepareTabbedIntelligence(input,config,existing,cutoff,now,'个股情报');}
function prepareCryptoIntelligence(input,config,existing,cutoff,now=new Date()){return prepareTabbedIntelligence(input,config,existing,cutoff,now,'加密情报');}
function prepareAiIntelligence(input,config,existing,cutoff,now=new Date()){return prepareTabbedIntelligence(input,config,existing,cutoff,now,'AI板块情报');}
module.exports={prepareNews,preparePeople,preparePeopleIntelligence,prepareTickerIntelligence,prepareCryptoIntelligence,prepareAiIntelligence,prepareTabbedIntelligence,windowStart};
