// An independent discussion stream, never a substitute for fact verification or weekly ranking.
const {annotateCard}=require('./person-names');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const date=value=>typeof value==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const materialFields=['title','fact','whyItMatters','impact','affected','knowledgeApplication','caveat','url','author','publishedAt','eventTime','eventTimeNote'];
function stamps(item,old,now){
  const changed=!old||materialFields.some(field=>JSON.stringify(item[field]??null)!==JSON.stringify(old[field]??null));
  return {...(old?.firstIncludedAt?{firstIncludedAt:old.firstIncludedAt}:!old?{firstIncludedAt:now.toISOString()}:{}),
    ...(changed?{lastMaterialAt:now.toISOString()}:old?.lastMaterialAt?{lastMaterialAt:old.lastMaterialAt}:{})};
}
function heatCompare(a,b){const d=(Number.isInteger(b.engagement?.views)?b.engagement.views:-1)-(Number.isInteger(a.engagement?.views)?a.engagement.views:-1);return d||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||String(a.url).localeCompare(String(b.url));}
function mergeHotspots(input,config,existing,cutoff,now=new Date()){
  assert(config.hotspotPolicy?.enabled,'个股热点尚未启用');
  assert(date(cutoff)&&Date.parse(cutoff)<=+now,'热点截止时间无效');
  const allowed=new Set(config.tabs.map(t=>t.id)),reports=new Map(),oldReports=new Map((existing.hotspotCoverage?.tabs||[]).map(t=>[t.id,t]));
  assert(Array.isArray(input.hotspotTabs)&&Array.isArray(input.hotspots),'热点必须独立交付hotspotTabs和hotspots，不能以事实区条数代替');
  for(const r of input.hotspotTabs){
    assert(allowed.has(r.id)&&!reports.has(r.id)&&['complete','partial','failed'].includes(r.status)&&r.note?.trim(),'热点对象检查结果无效');
    assert(Array.isArray(r.queries)&&(r.status==='failed'||r.queries.length>0),'热点成功检查须保存实际查询');
    reports.set(r.id,{...r,cutoff:r.status==='failed'?oldReports.get(r.id)?.cutoff||null:cutoff,lastAttemptAt:now.toISOString()});
  }
  assert(reports.size===allowed.size,'必须逐一报告所有配置股票的热点检查结果');
  const prior=[...(existing.hotspots||[]),...(existing.hotspotRetained||[])],seen=new Set(),urls=new Set();
  const incoming=input.hotspots.map(item=>{
    assert(allowed.has(item.tabId)&&reports.get(item.tabId).status!=='failed','热点所属股票无效');
    assert(item.eventKey?.trim()&&!seen.has(item.tabId+':'+item.eventKey),'同股同一热点事件不能重复');seen.add(item.tabId+':'+item.eventKey);
    const match=/^https:\/\/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})\/status\/\d+$/.exec(item.url||'');
    assert(match&&match[1].toLowerCase()===String(item.author).replace(/^@/,'').toLowerCase(),'热点原帖链接与作者不匹配');
    assert(!urls.has(item.tabId+':'+item.url),'同一股票不能重复收录同一原帖');urls.add(item.tabId+':'+item.url);
    assert(date(item.publishedAt)&&Date.parse(item.publishedAt)<=Date.parse(cutoff),'热点缺少准确发帖时间或晚于截止');
    const unit=(input.hotspotCollectionUnits||input.collectionUnits||[]).find(u=>u.object===item.tabId+':hotspots');
    const old=prior.find(p=>p.tabId===item.tabId&&(p.url===item.url||p.eventKey===item.eventKey));
    if(unit&&!old)assert(unit.needsQuery&&Date.parse(item.publishedAt)>=Date.parse(unit.start)&&Date.parse(item.publishedAt)<Date.parse(unit.end),'热点新增超出本对象严格增量窗口');
    assert(Date.parse(item.publishedAt)>=Date.parse(cutoff)-(config.hotspotPolicy.windowDays||1)*86400000,'热点超出展示窗口');
    for(const field of ['title','fact','originalText'])assert(typeof item[field]==='string'&&item[field].trim(),'热点缺少'+field);
    assert(item.verification==='collector-report'&&item.sourceNature==='non-official','热点须标明非官方、采集器转述');
    assert(item.eventTime?date(item.eventTime):!!item.eventTimeNote?.trim(),'热点实际事件时间未知须注明，不能以发帖时间冒充');
    const engagement=item.engagement||{};
    assert(date(engagement.capturedAt)&&Date.parse(engagement.capturedAt)<=+now&&['grok-web-observed','grok-app-observed'].includes(engagement.source),'热点缺少实际观察时间和来源');
    assert(Number.isInteger(engagement.views)&&engagement.views>=0,'浏览量缺失，不能进入浏览量前五；请保留在未排名候选审计');
    for(const k of ['likes','reposts','replies','views'])assert(engagement[k]==null||(Number.isInteger(engagement[k])&&engagement[k]>=0),'互动数不能估算或为负');
    const out={...item,...(old?.url===item.url?{eventKey:old.eventKey}:{}),...stamps(item,old,now)};delete out.weeklyRanks;delete out.tier;
    annotateCard(out,undefined,'ticker-hotspot.'+item.eventKey);
    return out;
  });
  const hotspots=[];
  for(const tab of config.tabs){
    const report=reports.get(tab.id),anchor=Date.parse(report.cutoff||cutoff);
    if(report.status==='failed'){hotspots.push(...(existing.hotspots||[]).filter(i=>i.tabId===tab.id));continue;}
    const snapshot=input.hotspotSnapshot===true&&report.status==='complete';
    if(snapshot){
      const unit=(input.hotspotCollectionUnits||[]).find(u=>u.object===tab.id+':hotspots');
      assert(unit&&Date.parse(unit.start)<=anchor-(config.hotspotPolicy.windowDays||1)*86400000&&Date.parse(unit.end)===anchor,'完整榜单替换须覆盖全部展示窗口');
    }
    const pool=new Map((snapshot?[]:prior).filter(i=>i.tabId===tab.id&&Date.parse(i.publishedAt)>=anchor-(config.hotspotPolicy.windowDays||1)*86400000).map(i=>[i.url,i]));
    for(const item of incoming.filter(i=>i.tabId===tab.id))pool.set(item.url,item);
    hotspots.push(...[...pool.values()].filter(i=>Number.isInteger(i.engagement?.views)&&i.engagement.views>=0).sort(heatCompare).slice(0,config.hotspotPolicy.limit||5));
  }
  const chosen=new Set(hotspots.map(i=>i.tabId+':'+i.eventKey));
  const hotspotRetained=[...new Map(prior.filter(i=>!chosen.has(i.tabId+':'+i.eventKey)&&Date.parse(i.lastMaterialAt||i.firstIncludedAt||i.publishedAt)>=Date.parse(cutoff)-7*86400000).map(i=>[i.tabId+':'+i.eventKey,i])).values()];
  return require('../../daily-records').capture(existing,{...existing,hotspots,hotspotRetained,hotspotCoverage:{tabs:[...reports.values()]},hotspotCutoff:[...reports.values()].some(r=>r.status!=='failed')?cutoff:existing.hotspotCutoff||null});
}
module.exports={mergeHotspots,heatCompare,stamps};
