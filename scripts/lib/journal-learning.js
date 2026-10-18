'use strict';
const { loadRegistry } = require('./person-names');
const date = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().startsWith(value);
const text = value => typeof value==='string' && value.trim().length>0;
const https = value => {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
function validateJournalLearning(config, data, now=new Date()) {
  const errors=[], fail=message=>errors.push(message);
  if(data?.schemaVersion!==1 || !Array.isArray(data?.reviews))return {errors:['论文选读数据结构无效'],papers:0};
  const journals=new Map((config?.journalPolicy?.journals||[]).map(j=>[j.id,j]));
  const registry=loadRegistry().people;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const ids=new Set(), dois=new Set(), slots=new Set();
  for(const p of data.reviews) {
    const journal=journals.get(p.journal), doi=String(p.doi||'').toLowerCase();
    if(!text(p.id)||ids.has(p.id))fail('论文选读ID缺失或重复');ids.add(p.id);
    if(!journal||p.journalName!==journal.name||!journal.doiPrefixes.some(prefix=>doi.startsWith(prefix))||dois.has(doi))fail('论文须为对应正刊、正确DOI且不得重复');dois.add(doi);
    if(!date(p.selectedDate)||p.selectedDate>today||!date(p.publishedDate)||p.publishedDate>p.selectedDate)fail('论文发表或选读日期无效');
    const slot=p.journal+':'+p.selectedDate;if(slots.has(slot))fail('每刊每天最多一篇');slots.add(slot);
    const canonical=journal?.id==='nature'?journal.urlPrefix+doi.replace('10.1038/',''):journal?.urlPrefix+doi;
    if(!https(p.paperUrl)||p.paperUrl!==canonical)fail('缺少正刊规范原文链接');
    for(const key of ['title','originalTitle','category','takeaway','stage','accessNote'])if(!text(p[key]))fail(`论文缺少${key}`);
    for(const key of ['problem','method','findings','statistics','limitations','meaning'])if(!text(p.summary?.[key]))fail(`论文摘要缺少${key}`);
    if(!['full-text','partial','abstract'].includes(p.accessLevel)||!['recent','classic'].includes(p.selectionKind))fail('论文阅读范围或选题类型无效');
    if(p.selectionKind==='recent'&&date(p.selectedDate)&&date(p.publishedDate)&&Date.parse(p.selectedDate)-Date.parse(p.publishedDate)>(config.journalPolicy.preferredRecentDays||30)*86400000)fail('旧论文不能标近期研究');
    const authors=Array.isArray(p.authors)?p.authors:[];
    if(!authors.length||authors.some(a=>!text(a)||!registry.some(r=>r.name===a)))fail('作者须保留原文并先登记经核实的简介');
    if(!Array.isArray(p.people)||authors.some(a=>!p.people.some(person=>person.name===a&&registry.some(r=>r.name===a&&r.intro===person.intro))))fail('论文缺少作者简介');
    if(!Array.isArray(p.sources)||!p.sources.length||p.sources.some(s=>!text(s.label)||!https(s.url)))fail('论文缺少可回查阅读来源');
  }
  for(const id of ['nature','science']) {
    const c=data.coverage?.[id];
    if(!c||!date(c.date)||!['complete','partial','failed'].includes(c.status)||!text(c.note)||!Array.isArray(c.queries)||!Number.isFinite(Date.parse(c.checkedAt)))fail(`${id}缺少本轮覆盖及缺口`);
    if(c?.status==='complete'&&!data.reviews.some(p=>p.journal===id&&p.selectedDate===c.date))fail(`${id}没有当日内容不能标完成`);
  }
  return {errors,papers:data.reviews.length};
}
module.exports={validateJournalLearning};
