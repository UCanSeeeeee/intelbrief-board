const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { slotAt, prepareBrief, saveBrief, isPublishDue } = require('../scripts/lib/stock-brief');
const now = new Date('2026-10-11T20:42:00+08:00');
function event(n, knowledge=false) {
  return {
    eventKey:`fixture-${n}`,title:`测试事件 ${n}`,fact:'仅用于自动化测试的原帖陈述',impact:'条件性的影响判断',direction:'双向',horizon:'未来两周',affected:['测试行业'],counterCase:'反向条件',selectionReason:'与其他候选比较后的理由',credibilityReason:'仅为测试证据，未经校准',change:'新增',eventTime:null,eventTimeNote:'来源未说明实际发生时间',attentionEvidence:'测试关注依据',
    ...(knowledge ? {knowledgeCards:['M01','R04'],disciplines:['宏观经济','行为金融'],knowledgeApplication:'测试条件性传导与反证'} : {}),
    sources:[{url:`https://x.com/TestOnly/status/${n+1000}`,postId:String(n+1000),username:'TestOnly',publishedAt:'2026-10-11T18:00:00+08:00',checkedAt:'2026-10-11T20:35:00+08:00',excerpt:'Synthetic fixture only, not a real financial news item.',verification:'collector-report',verificationNote:'仅为测试'}]
  };
}
function fixture() {
  return {scheduledFor:'2026-10-11T20:30:00+08:00',windowStart:'2026-10-11T15:00:00+08:00',status:'complete',summary:'仅测试，不发布',marketContext:'测试休市说明',coverage:{method:'测试夹具',queries:['测试公开查询'],gaps:[]},selectionRationale:'测试比较依据',excludedCandidates:[],focus:Array.from({length:5},(_,i)=>event(i)),insights:Array.from({length:10},(_,i)=>event(i+5,true))};
}
const prepare = input => prepareBrief(input, {now});
test('Beijing slots include weekends, midnight and exact boundary',()=> {
  assert.equal(slotAt(new Date('2026-10-11T00:00:00+08:00')).previous.id,'2026-10-10-2030');
  assert.equal(slotAt(new Date('2026-10-11T07:59:59+08:00')).next.id,'2026-10-11-0800');
  assert.equal(slotAt(new Date('2026-10-11T08:00:00+08:00')).previous.id,'2026-10-11-0800');
  assert.equal(slotAt(new Date('2026-10-11T20:30:00+08:00')).previous.id,'2026-10-11-2030');
  assert.equal(slotAt(new Date('2026-10-11T20:30:00+08:00')).next.id,'2026-10-12-0800');
});
test('publish immediately when cutoff already passed; config slots are 08/15/20:30 only',()=> {
  assert.deepEqual(require('../scripts/lib/stock-brief').config.slots, ['08:00','15:00','20:30']);
  assert.equal(isPublishDue('2026-10-16T08:00:00+08:00', new Date('2026-10-16T08:18:00+08:00')), true);
  assert.equal(isPublishDue('2026-10-16T08:00:00+08:00', new Date('2026-10-16T07:59:00+08:00')), false);
  const late = fixture();
  late.scheduledFor = '2026-10-16T08:00:00+08:00';
  late.windowStart = '2026-10-15T20:30:00+08:00';
  for (const e of [...late.focus, ...late.insights]) {
    e.sources[0].publishedAt = '2026-10-16T07:50:00+08:00';
    e.sources[0].checkedAt = '2026-10-16T08:10:00+08:00';
  }
  assert.equal(prepareBrief(late, { now: new Date('2026-10-16T08:18:00+08:00') }).id, '2026-10-16-0800');
  // Historical 09:00 archives still prepare (validate-data); slotAt must not mint new 0900 periods.
  const legacy = fixture();
  legacy.scheduledFor = '2026-10-15T21:00:00+08:00';
  legacy.windowStart = '2026-10-15T16:00:00+08:00';
  for (const e of [...legacy.focus, ...legacy.insights]) {
    e.sources[0].publishedAt = '2026-10-15T20:00:00+08:00';
    e.sources[0].checkedAt = '2026-10-15T21:05:00+08:00';
  }
  assert.equal(prepareBrief(legacy, { now: new Date('2026-10-15T21:12:00+08:00') }).id, '2026-10-15-2100');
  assert.equal(slotAt(new Date('2026-10-16T08:00:00+08:00')).previous.id, '2026-10-16-0800');
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'../docs/STOCK_BRIEF.md'),'utf8'), /禁止空等截止/);
});
test('complete edition has exactly 5+10 and preserves input',()=> {
  const input=fixture(); const result=prepare(input);
  assert.deepEqual(result.counts,{focus:5,insights:10,total:15});
  assert.equal(result.id,'2026-10-11-2030');
  assert.equal(input.generatedAt,undefined);
  input.insights.pop(); assert.throws(()=>prepare(input),/5\+10/);
});
test('reject duplicated event, title or evidence across groups',()=> {
  for (const key of ['eventKey','title']) {
    const b=fixture(); b.insights[0][key]=b.focus[0][key]; assert.throws(()=>prepare(b),/重复/);
  }
  const b=fixture(); b.insights[0].sources=b.focus[0].sources; assert.throws(()=>prepare(b),/多个名额/);
});
test('fact is a reader-facing summary, not a collector report',()=> {
  const b=fixture();b.focus[0].fact='Grok 返回的 Example 原帖称，测试消息';
  assert.throws(()=>prepare(b),/采集过程话术/);
  const c=fixture();c.focus[0].eventTimeNote='Grok 未提供事件时间';
  assert.throws(()=>prepare(c),/事件时间说明/);
});
test('future posts, bad links and missing publication time are rejected',()=> {
  const mutations=[s=>s.publishedAt='2026-10-11T20:31:00+08:00',s=>s.url='https://example.com/a',s=>delete s.publishedAt,s=>s.postId=1000,s=>s.checkedAt='2026-10-12T20:31:00+08:00'];
  for (const mutate of mutations) { const b=fixture(); mutate(b.focus[0].sources[0]); assert.throws(()=>prepare(b)); }
  assert.throws(()=>prepareBrief(fixture(),{now:new Date('2026-10-11T20:00:00+08:00')}),/提前/);
});
test('old evidence cannot masquerade as a new event',()=> {
  const b=fixture(); b.focus[0].sources[0].publishedAt='2026-10-10T18:00:00+08:00';
  assert.throws(()=>prepare(b),/旧帖/);
  b.focus[0].contextSourceNote='旧背景'; assert.throws(()=>prepare(b),/窗口内/);
  b.focus[0].change='延续'; b.focus[0].continuationReason='测试说明持续影响'; assert.equal(prepare(b).counts.total,15);
});
test('insights require valid cards and a cross-disciplinary application',()=> {
  for (const change of [e=>e.knowledgeCards=['M99'],e=>e.knowledgeApplication='',e=>e.disciplines=['宏观','宏观']]) {
    const b=fixture(); change(b.insights[0]); assert.throws(()=>prepare(b));
  }
});
test('collector results are capped and cannot inherit high-confidence meaning',()=> {
  const result=prepareBrief(fixture(),{now,sources:new Map([['testonly',{trustTier:'primary'}]])});
  const score=result.focus[0].sources[0].credibility;
  assert.equal(score.overall,49); assert.match(score.meaning,/未独立直读/);
});
test('partial and failed editions carry explicit shortfall',()=> {
  const b=fixture(); b.status='partial'; b.focus=b.focus.slice(0,2); b.insights=[];
  assert.throws(()=>prepare(b),/缺额/); b.shortfallReason='只有两条符合条件'; assert.equal(prepare(b).counts.total,2);
  b.status='failed'; assert.throws(()=>prepare(b),/失败/); b.focus=[]; assert.equal(prepare(b).counts.total,0);
});
test('completed searches with zero qualifying events remain partial, not failed',()=> {
  const b=fixture();
  Object.assign(b,{status:'partial',focus:[],insights:[],shortfallReason:'两轮已执行，候选无实质新增，未达到价值门槛',displayWindowStart:'2026-10-10T20:30:00+08:00',displayWindowEnd:b.scheduledFor,carriedOver:[],candidates:[],checklist:[{item:'第一轮市场焦点',status:'no-result',note:'仅测试，无合格候选'},{item:'第二轮六包独立检索',status:'no-result',note:'仅测试，无合格候选'}]});
  b.coverage.queries=['测试第一轮查询','测试第二轮独立查询'];
  const result=prepare(b);
  assert.equal(result.status,'partial');
  assert.equal(result.counts.total,0);
  assert.equal(result.schemaVersion,2);
  b.coverage.queries=[];assert.throws(()=>prepare(b),/实际查询/);
  b.coverage.queries=['测试查询'];b.shortfallReason='';assert.throws(()=>prepare(b),/缺额原因/);
});
test('research priority headings are not knowledge card identifiers',()=> {
  const b=fixture();b.insights[0].knowledgeCards=['P1'];
  assert.throws(()=>prepare(b),/有效知识卡编号/);
  b.insights[0].knowledgeCards=['I01','I02'];assert.equal(prepare(b).counts.total,15);
});
test('archives are immutable and only the latest three editions are retained',()=> {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stock-brief-test-'));
  try {
    const b=prepare(fixture()); saveBrief(b,dir); saveBrief(b,dir);
    assert.throws(()=>saveBrief({...b,summary:'changed'},dir),/禁止覆盖/);
    const earlier=fixture(); earlier.scheduledFor='2026-10-11T15:00:00+08:00'; earlier.windowStart='2026-10-11T08:00:00+08:00';
    for (const e of [...earlier.focus,...earlier.insights]) e.sources[0].publishedAt='2026-10-11T14:00:00+08:00';
    saveBrief(prepare(earlier),dir);
    for (const [scheduledFor,windowStart] of [['2026-10-11T08:00:00+08:00','2026-10-10T20:30:00+08:00'],['2026-10-10T20:30:00+08:00','2026-10-10T15:00:00+08:00']]) {
      const old=fixture();old.scheduledFor=scheduledFor;old.windowStart=windowStart;
      for(const e of [...old.focus,...old.insights]) e.sources[0].publishedAt=windowStart;
      saveBrief(prepareBrief(old,{now:new Date('2026-10-11T20:42:00+08:00')}),dir);
    }
    const index=JSON.parse(fs.readFileSync(path.join(dir,'data/stock-briefs/index.json'),'utf8'));
    assert.deepEqual(index.editions.map(e=>e.id),['2026-10-11-2030','2026-10-11-1500','2026-10-11-0800']);
    assert.equal(fs.existsSync(path.join(dir,'data/stock-briefs/2026-10-10-2030.json')),false);
    assert.throws(()=>saveBrief({...b,id:'../../escape'},dir),/无效/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('browser renderer shows 5+10, escapes content, and clears failed edition',async()=> {
  const brief=prepare(fixture());
  brief.focus[0].title='<img src=x onerror=alert(1)>';
  const elements=new Map();
  const element=id=> {
    if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',disabled:true,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});
    return elements.get(id);
  };
  const entry={id:brief.id,file:brief.id+'.json',scheduledFor:brief.scheduledFor,status:brief.status,counts:brief.counts};
  const second={...entry,id:'2026-10-11-1500',file:'2026-10-11-1500.json'};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../briefs.js'),'utf8'),{
    document:{getElementById:element},Intl,Date,
    fetch:async url=>({ok:!url.endsWith(second.file),json:async()=> url.startsWith('config/')?{slots:['08:00','15:00','20:30'],targetCounts:{focus:5,insights:10}}:url.endsWith('index.json')?{editions:[entry,second]}:brief})
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(element('focus-count').textContent,'');
  assert.equal(element('insights-count').textContent,'');
  assert.match(element('brief-focus').innerHTML,/影响判断/);
  assert.doesNotMatch(element('brief-focus').innerHTML,/反向条件/);
  assert.match(element('brief-focus').innerHTML,/待独立核验/);
  assert.match(element('brief-focus').innerHTML,/&lt;img/);
  assert.doesNotMatch(element('brief-focus').innerHTML,/<img/);
  assert.match(element('brief-insights').innerHTML,/宏观经济 × 行为金融/);
  assert.doesNotMatch(element('brief-insights').innerHTML,/证据与筛选依据/);
  assert.doesNotMatch(element('brief-insights').innerHTML,/采集器返回，未独立直读/);
  assert.match(element('brief-focus').innerHTML,/作者/);
  assert.match(element('brief-focus').innerHTML,/信息摘要/);
  assert.match(element('brief-focus').innerHTML,/事件时间/);
  assert.match(element('brief-focus').innerHTML,/原文链接/);
  element('edition-select').value=second.id;
  element('edition-select').listeners.change();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(element('brief-focus').innerHTML,/读取失败/);
});
