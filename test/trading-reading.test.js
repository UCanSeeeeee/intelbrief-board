const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {calendar,session,context,readingWindow}=require('../scripts/lib/trading-session');
const {advance,emptyBoard}=require('../scripts/lib/reading-board');
const {prepareBrief,saveBrief}=require('../scripts/lib/stock-brief');
const {uncoveredRanges}=require('../scripts/lib/windows');
function event(n=1){return {eventKey:'test-'+n,title:'测试夹具 '+n,fact:'测试事实 '+n,impact:'测试传导',direction:'待定',horizon:'测试',affected:['测试'],counterCase:'测试反证',selectionReason:'测试排序',credibilityReason:'测试',change:'新增',eventTime:null,eventTimeNote:'未知',attentionEvidence:'测试',sources:[{url:`https://x.com/TestOnly/status/${1000+n}`,postId:String(1000+n),username:'TestOnly',publishedAt:'2026-09-05T02:00:00Z',checkedAt:'2026-09-05T02:00:00Z',excerpt:'Synthetic only',verification:'collector-report',verificationNote:'测试'}]};}
function brief(day='2026-09-05',hour='09',n=1){const scheduledFor=`${day}T${hour}:00:00+08:00`,generatedAt=new Date(Date.parse(scheduledFor)+3600000).toISOString();const e=event(n);e.sources[0].publishedAt=new Date(Date.parse(scheduledFor)-60000).toISOString();e.sources[0].checkedAt=generatedAt;return {id:`${day}-${hour}00`,scheduledFor,generatedAt,windowStart:new Date(Date.parse(scheduledFor)-86400000).toISOString(),status:'partial',summary:'仅测试',marketContext:'仅测试',coverage:{method:'测试',queries:['测试'],gaps:[]},selectionRationale:'仅测试',excludedCandidates:[],shortfallReason:'测试缺额',focus:[e],insights:[]};}
test('NYSE calendar uses DST and early closes, not fixed Beijing hours',()=>{
  assert.equal(session('2026-10-12').openAt,'2026-10-12T13:30:00.000Z');
  assert.equal(session('2026-11-02').openAt,'2026-11-02T14:30:00.000Z');
  assert.equal(session('2026-11-27').closeAt,'2026-11-27T18:00:00.000Z');
  assert.equal(session('2026-12-24').closeAt,'2026-12-24T18:00:00.000Z');
  assert.equal(session('2026-07-03'),null);
  assert.notEqual(session('2026-10-12'),null); // bank holiday is not an equity holiday
  assert.notEqual(session('2027-12-31'),null); // no Friday observation for Jan 1, 2028
});
test('long weekends, Good Friday and New Year map to the first actual session',()=>{
  assert.equal(context('2026-09-05T01:00:00Z').date,'2026-09-08');
  assert.equal(readingWindow('2026-09-08T13:00:00Z').start,'2026-09-04T20:00:00.000Z');
  assert.equal(context('2026-04-03T13:00:00Z').date,'2026-04-06');
  assert.equal(context('2027-01-01T01:00:00Z').date,'2027-01-04');
  assert.equal(context('2026-10-13T02:00:00+08:00').date,'2026-10-12'); // Beijing midnight does not split session
});
test('unknown calendars hold data, and official exceptional closures can extend retention',()=>{
  assert.equal(context('2029-01-03T01:00:00Z').known,false);
  const cfg=structuredClone(calendar);cfg.overrides['2026-09-08']={closed:true,reason:'测试临时休市',source:'https://www.nyse.com/test-only'};
  assert.equal(context('2026-09-05T01:00:00Z',cfg).date,'2026-09-09');
  cfg.overrides['2026-09-08']={closed:true};assert.equal(context('2026-09-05T01:00:00Z',cfg).known,false);
});
test('holiday items survive more than three editions and through the reopening session',()=>{
  let board=advance(emptyBoard(),brief());
  for(const [d,h]of [['2026-09-05','16'],['2026-09-05','21'],['2026-09-06','09'],['2026-09-07','21'],['2026-09-08','21']]){
    const b=brief(d,h,2);b.focus=[];board=advance(board,b);
  }
  assert.equal(board.events[0].state,'active');assert.equal(board.events[0].retainUntil,'2026-09-08T20:00:00.000Z');
  const after=brief('2026-09-09','09',2);after.focus=[];
  assert.equal(advance(board,after).events[0].state,'served');
});
test('failures never erase pending reading; clock alone does not mark an item read',()=>{
  const board=advance(emptyBoard(),brief());const failure=brief('2026-09-09','09');failure.focus=[];failure.status='failed';
  const next=advance(board,failure);assert.equal(next.events[0].state,'active');assert.match(next.warnings.join(),/采集失败/);
});
test('calendar expiry holds pending cards and a recovered calendar assigns a real session',()=>{
  const b=brief('2029-01-03');let board=advance(emptyBoard(),b);assert.equal(board.events[0].retainUntil,null);
  const cfg=structuredClone(calendar);cfg.validThrough='2029-12-31';cfg.holidays.push('2029-01-01');
  const next=brief('2029-01-03','16',2);next.focus=[];board=advance(board,next,cfg);assert.ok(board.events[0].retainUntil);
});
test('repeated commentary cannot renew forever; substantive progress preserves old version',()=>{
  const first=brief();const board=advance(emptyBoard(),first);
  const repeat=brief('2026-09-09','09');repeat.focus=structuredClone(first.focus);
  assert.equal(advance(board,repeat).events[0].state,'served');
  repeat.focus[0].fact='测试实际新增';const updated=advance(board,repeat);
  assert.equal(updated.events.length,1);assert.equal(updated.events[0].state,'active');assert.equal(updated.events[0].history[0].event.fact,first.focus[0].fact);
  assert.equal(updated.events[0].firstSeenAt,first.generatedAt);
});
test('retractions need evidence, remain auditable, and are excluded from the live pool',()=>{
  const board=advance(emptyBoard(),brief());const b=brief('2026-09-05','16',2);b.focus=[];
  b.readingDecisions=[{eventKey:'test-1',action:'retracted',reason:'测试正式更正',sourceUrl:'https://x.com/TestOnly/status/9999',checkedAt:b.generatedAt}];
  const next=advance(board,b);assert.equal(next.events[0].state,'retracted');assert.equal(next.selected.focus.length,0);
  delete b.readingDecisions[0].reason;assert.throws(()=>advance(board,b),/原因/);
});
test('selection limits do not delete overflow; repeated publication is idempotent',()=>{
  let board=emptyBoard();for(let n=1;n<8;n++){const b=brief('2026-09-05',n<4?'09':'16',n);b.id+='-'+n;board=advance(board,b);}
  assert.equal(board.events.filter(e=>e.state==='active').length,7);assert.equal(board.selected.focus.length,5);
  const next=brief('2026-09-05','21',8);next.readingSelection={focus:['test-1','test-8'],insights:[]};
  const updated=advance(board,next);assert.deepEqual(updated.selected.focus,['test-1','test-8']);assert.deepEqual(advance(updated,next),updated);
  next.readingSelection.focus=['unknown'];assert.throws(()=>advance(board,next),/精选编号/);
});
test('same evidence cannot get a new cross-edition event key',()=>{
  const b=brief(),board=advance(emptyBoard(),b),next=brief('2026-09-05','16');next.focus[0].eventKey='different';
  assert.throws(()=>advance(board,next),/沿用事件键/);
});
test('publishing persists full cards before pruning the fourth archive',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reading-test-'));
  try{for(const [i,h]of ['09','16','21'].entries()){const b=brief('2026-09-05',h,i+1);saveBrief(prepareBrief(b,{now:new Date(b.generatedAt)}),dir);}
    const b=brief('2026-09-06','09',4);saveBrief(prepareBrief(b,{now:new Date(b.generatedAt)}),dir);
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'data/reading-board.json'),'utf8'));
    assert.equal(saved.events.length,4);assert.equal(fs.existsSync(path.join(dir,'data/stock-briefs/2026-09-05-0900.json')),false);assert.ok(saved.events[0].event.counterCase);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('partial/failed/legacy coverage never suppresses missing searches',()=>{
  const start='2026-09-05T00:00:00Z',end='2026-09-06T00:00:00Z';
  for(const status of [undefined,'partial','failed'])assert.equal(uncoveredRanges({records:[{page:'news',start,end,status}]},'news',start,end).length,1);
  assert.equal(uncoveredRanges({records:[{page:'news',start,end,status:'complete'}]},'news',start,end).length,0);
  assert.equal(uncoveredRanges({records:[{page:'news',start,end,status:'complete',trigger:'manual'}]},'news',start,end).length,1);
});
test('official calendar correction extends existing pending cards before expiry',()=>{
  const board=advance(emptyBoard(),brief());const cfg=structuredClone(calendar);
  cfg.overrides['2026-09-08']={closed:true,source:'https://www.nyse.com/test-only',reason:'测试'};
  const b=brief('2026-09-09','09');b.focus=[];
  const updated=advance(board,b,cfg);assert.equal(updated.events[0].state,'active');assert.equal(updated.events[0].targetSession,'2026-09-09');
});
test('bad lifecycle input cannot freeze an archive; coverage is persisted conservatively',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reading-validation-'));
  try{
    const b=brief();b.readingDecisions=[{eventKey:'test-1',action:'keep',reason:'测试',sourceUrl:'https://x.com/TestOnly/status/1234',checkedAt:'2026-09-06T00:00:00Z'}];
    assert.throws(()=>saveBrief(prepareBrief(b,{now:new Date(b.generatedAt)}),dir),/复核时间/);
    assert.equal(fs.existsSync(path.join(dir,'data/stock-briefs/'+b.id+'.json')),false);
    delete b.readingDecisions;b.coverage.status='complete';
    saveBrief(prepareBrief(b,{now:new Date(b.generatedAt)}),dir);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'data/search-coverage.json'))).records[0].status,'partial');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('reading renderer preserves overflow, warns on failed reload, and supports historical snapshots',async()=>{
  const vm=require('node:vm');let board=emptyBoard();
  for(let n=1;n<=7;n++){const b=brief('2026-09-05','09',n);b.id+='-'+n;board=advance(board,b);}
  const b=brief();b.counts={focus:1,insights:0,total:1};const entry={id:b.id,file:b.id+'.json',scheduledFor:b.scheduledFor,status:'partial',counts:b.counts};
  const elements=new Map(),listeners={};const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',listeners:{},addEventListener(n,f){this.listeners[n]=f;}});return elements.get(id);};
  let failBoard=false;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../briefs.js'),'utf8'),{Intl,Date,document:{getElementById:element,addEventListener:(n,f)=>listeners[n]=f},fetch:async url=>({ok:!(failBoard&&url.endsWith('reading-board.json')),json:async()=>url.startsWith('config/')?{targetCounts:{focus:5,insights:10}}:url.endsWith('index.json')?{editions:[entry]}:url.endsWith('reading-board.json')?board:b})});
  const tick=()=>new Promise(r=>setImmediate(r));await tick();
  assert.equal(element('edition-select').value,'reading');assert.match(element('focus-count').textContent,/精选 5 条 · 另保留 2 条/);assert.equal((element('brief-focus').innerHTML.match(/<article/g)||[]).length,7);
  assert.match(element('reading-context').textContent,/以下均为北京时间/);
  assert.match(element('reading-context').textContent,/2026\/09\/08 21:30 开盘 → 2026\/09\/09 04:00 收盘/);
  assert.doesNotMatch(element('reading-context').textContent,/美东交易日/);
  failBoard=true;listeners['intelbrief:updated']({detail:{page:'news'}});await tick();assert.match(element('reading-context').textContent,/刷新失败/);assert.match(element('brief-focus').innerHTML,/未删除/);
  element('edition-select').value=b.id;element('edition-select').listeners.change();await tick();assert.match(element('reading-context').textContent,/历史期次快照/);assert.equal((element('brief-focus').innerHTML.match(/<article/g)||[]).length,1);
});
