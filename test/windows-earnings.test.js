const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const w=require('../scripts/lib/windows');
const fe=require('../scripts/fetch-earnings');
const {prepareNews}=require('../scripts/lib/update-results');
const {saveBrief}=require('../scripts/lib/stock-brief');
const {carriedOver}=require('../scripts/update-runner');

test('beijingIso formats via Intl regardless of input offset',()=>{
  assert.equal(w.beijingIso('2026-10-12T01:00:00Z'),'2026-10-12T09:00:00+08:00');
  assert.equal(w.beijingIso('2026-10-12T09:00:00+08:00'),'2026-10-12T09:00:00+08:00');
  assert.equal(w.beijingIso('2026-10-11T20:00:00-05:00'),'2026-10-12T09:00:00+08:00');
});

test('display window covers 24h and the prior actual close, not arbitrary weekend midnight',()=>{
  assert.deepEqual(w.displayWindow('2026-10-13T09:00:00+08:00'),{displayWindowStart:'2026-10-12T09:00:00+08:00',displayWindowEnd:'2026-10-13T09:00:00+08:00'});
  assert.equal(w.displayWindow('2026-10-12T09:00:00+08:00').displayWindowStart,'2026-10-10T04:00:00+08:00');
  assert.equal(w.weekendStart('2026-10-11T21:00:00+08:00'),null);
});

test('search window covers the reading interval; only successful coverage skips queries',()=>{
  const editions=[{scheduledFor:'2026-10-12T21:00:00+08:00',trigger:'scheduled',status:'complete'}];
  assert.equal(w.windowStart(editions,{cutoff:'2026-10-13T09:00:00+08:00',trigger_type:'scheduled'}),'2026-10-12T01:00:00.000Z');
  // Monday with a Sunday 21:00 edition still covers Sat/Sun.
  const mon=[{scheduledFor:'2026-10-11T21:00:00+08:00',trigger:'scheduled',status:'complete'}];
  assert.equal(w.windowStart(mon,{cutoff:'2026-10-12T09:00:00+08:00',trigger_type:'scheduled'}),'2026-10-09T20:00:00.000Z');
  // No prior edition, non-Monday: 24h.
  assert.equal(w.windowStart([],{cutoff:'2026-10-14T09:00:00+08:00',trigger_type:'scheduled'}),'2026-10-13T01:00:00.000Z');
});

test('search coverage records dedupe searched spans',()=>{
  let cov={schemaVersion:1,records:[]};
  cov=w.recordCoverage(cov,{jobId:'a',page:'news',start:'2026-10-12T09:00:00+08:00',end:'2026-10-12T21:00:00+08:00',queries:['q1'],status:'complete'},14,Date.parse('2026-10-13T00:00:00Z'));
  assert.deepEqual(w.uncoveredRanges(cov,'news','2026-10-12T09:00:00+08:00','2026-10-13T09:00:00+08:00'),[{start:'2026-10-12T21:00:00+08:00',end:'2026-10-13T09:00:00+08:00'}]);
  assert.deepEqual(w.uncoveredRanges(cov,'people','2026-10-12T09:00:00+08:00','2026-10-12T10:00:00+08:00').length,1);
  assert.throws(()=>w.recordCoverage(cov,{jobId:'b',page:'news',start:'2026-10-12T10:00:00Z',end:'2026-10-12T09:00:00Z'}),/区间无效/);
});

const failed={status:'failed',summary:'测试',marketContext:'测试',coverage:{method:'测试',queries:[],gaps:['无']},selectionRationale:'测试',excludedCandidates:[],focus:[],insights:[],shortfallReason:'测试失败',checklist:[]};
test('v2 briefs carry display window and require checklist and candidates',()=>{
  const job={id:crypto.randomUUID(),cutoff:'2026-10-12T01:00:00Z',trigger_type:'scheduled'};
  const brief=prepareNews(failed,job,'2026-10-11T13:00:00.000Z',new Map(),new Date('2026-10-12T02:00:00Z'));
  assert.equal(brief.schemaVersion,2);
  assert.equal(brief.scheduledFor,'2026-10-12T09:00:00+08:00');
  assert.equal(brief.displayWindowStart,'2026-10-10T04:00:00+08:00');
  const {checklist,...noList}=failed;
  assert.throws(()=>prepareNews(noList,job,'2026-10-11T13:00:00.000Z',new Map(),new Date('2026-10-12T02:00:00Z')),/检索前清单/);
  assert.throws(()=>prepareNews({...failed,checklist:[{item:'就业',status:'no-result'}]},job,'2026-10-11T13:00:00.000Z',new Map(),new Date('2026-10-12T02:00:00Z')),/需要说明/);
  assert.throws(()=>prepareNews({...failed,candidates:[{eventKey:'x',round:3,decision:'selected',reason:'r'}]},job,'2026-10-11T13:00:00.000Z',new Map(),new Date('2026-10-12T02:00:00Z')),/映射/);
});

test('manual editions never evict scheduled archives',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'history-'));
  try {
    const sched=prepareNews(failed,{id:crypto.randomUUID(),cutoff:'2026-10-11T01:00:00Z',trigger_type:'scheduled'},'2026-10-10T01:00:00.000Z',new Map(),new Date('2026-10-12T00:00:00Z'));
    saveBrief(sched,dir);
    for(let i=0;i<5;i++) saveBrief(prepareNews(failed,{id:crypto.randomUUID(),cutoff:new Date(Date.parse('2026-10-11T05:00:00Z')+i*60000).toISOString(),trigger_type:'manual'},'2026-10-10T05:00:00.000Z',new Map(),new Date('2026-10-12T00:00:00Z')),dir);
    const index=JSON.parse(fs.readFileSync(path.join(dir,'data/stock-briefs/index.json'),'utf8'));
    assert.equal(index.editions.filter(e=>e.trigger==='scheduled').length,1);
    assert.equal(index.editions.filter(e=>e.trigger==='manual').length,3);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('carriedOver pulls earlier in-window items not re-reported',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carry-'));
  try {
    fs.mkdirSync(path.join(dir,'data/stock-briefs'),{recursive:true});
    const old={id:'2026-10-12-2100',focus:[{eventKey:'k1',title:'旧事件',fact:'f',sources:[{url:'https://x.com/a/status/1',publishedAt:'2026-10-12T15:00:00+08:00'}]},{eventKey:'k2',title:'重复',fact:'f',sources:[{url:'https://x.com/a/status/2',publishedAt:'2026-10-12T15:00:00+08:00'}]}],insights:[]};
    fs.writeFileSync(path.join(dir,'data/stock-briefs/2026-10-12-2100.json'),JSON.stringify(old));
    const out=carriedOver(dir,[{file:'2026-10-12-2100.json',scheduledFor:'2026-10-12T21:00:00+08:00',status:'partial'}],{cutoff:'2026-10-13T09:00:00+08:00'},'2026-10-12T13:00:00.000Z',{focus:[{eventKey:'K2'}]});
    assert.deepEqual(out.map(c=>c.eventKey),['k1']);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('earnings: symbol normalization, theme dedupe, truncation report',()=>{
  assert.equal(fe.normalizeSymbol('brk-b'),'BRK.B');
  const themes=fe.themeIndex();
  assert.equal(themes.get('CEG').length,1);
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/earnings-calendar.json'),'utf8'));
  for(const t of Object.values(cfg.themes)) assert.equal(new Set(t.tickers).size,t.tickers.length);
  assert.equal(cfg.important.minMarketCapUsd,undefined);
  const rows=Array.from({length:4},(_,i)=>({symbol:'ZZ'+i,marketCap:'$'+(2e11+i)}));
  const picked=fe.pickImportant(rows,new Map(),2);
  assert.deepEqual(picked.map(p=>p.symbol),['ZZ3','ZZ2']);
  assert.deepEqual(picked.truncated,['ZZ1','ZZ0']);
});

test('earnings: retries with backoff then falls back to stale prior day',async()=>{
  let calls=0;
  const flaky=async()=>{calls++; if(calls<3) throw new Error('HTTP 429'); return [];};
  assert.deepEqual(await fe.fetchDayWithRetry('2026-10-12',{fetcher:flaky,baseMs:0,retries:3}),[]);
  assert.equal(calls,3);
  const prior=new Map([['2026-10-12',{date:'2026-10-12',weekday:'周一',rawCount:7,items:[{symbol:'AAA'}]}]]);
  const orig=console.error; console.error=()=>{};
  try {
    const week=await fe.buildWeek('current','本周','2026-10-12',new Map(),new Map(),prior,async()=>{throw new Error('down');});
    assert.equal(week.days[0].stale,true);
    assert.equal(week.days[0].rawCount,7);
    assert.equal(week.days[1].stale,true);
    assert.equal(week.days[1].items.length,0);
  } finally {console.error=orig;}
});

test('login throttle blocks after 5 failures within 10 minutes',async()=>{
  const m=await import('../server/updates.mjs');
  for(let i=0;i<5;i++) m.noteLoginFailure('9.9.9.9',0);
  assert.equal(m.loginBlocked('9.9.9.9',1000),true);
  assert.equal(m.loginBlocked('9.9.9.9',700000),false);
});

test('collector prompt states display/search split, uncovered spans and checklist',()=>{
  const {collectorPrompt}=require('../scripts/lib/update-prompt');
  const p=collectorPrompt({page:'news',cutoff:'2026-10-12T01:00:00Z'},path.join(__dirname,'..'),'2026-10-09T16:00:00.000Z',{},{displayWindowStart:'2026-10-10T04:00:00+08:00',displayWindowEnd:'2026-10-12T09:00:00+08:00',uncovered:[{start:'a',end:'b'}]});
  assert.match(p,/展示窗口与检索窗口分离/);
  assert.match(p,/a 至 b/);
  assert.match(p,/checklist/);
  assert.match(p,/周一/);
});
