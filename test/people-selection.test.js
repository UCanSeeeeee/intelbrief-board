const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {preparePeopleIntelligence}=require('../scripts/lib/content-results');
const {checkTabSelection}=require('../scripts/lib/selection-policy');
const config=JSON.parse(fs.readFileSync(path.join(root,'config/people-intelligence.json'),'utf8'));
const cutoff='2026-10-13T02:00:00Z',now=new Date('2026-10-13T02:10:00Z');
const tabs=config.tabs.map(tab=>({id:tab.id,status:'complete',note:'两轮检索已完成'}));
let n=0;
function item(sel,extra={}){n++;return {eventKey:`e-${n}`,tabIds:['elon-musk'],title:'Elon Musk 发帖',fact:'事实',whyItMatters:'影响',counterCase:'反向',affected:['TSLA'],author:'elonmusk',publishedAt:'2026-10-13T01:00:00Z',url:`https://x.com/elonmusk/status/${1000+n}`,verification:'collector-report',tier:'watch',weeklyRanks:{},selection:sel,...(sel==='engagement'?{engagement:{likes:100,reposts:10,views:5000,capturedAt:'2026-10-13T02:05:00Z',source:'x-tool search_posts_all public_metrics'}}:{}),...extra};}
const run=items=>preparePeopleIntelligence({checkedAt:now.toISOString(),tabs,items},config,{items:[]},cutoff,now);

test('config: every people tab targets 5 with selection policy',()=>{
  assert.equal(config.selectionPolicy.target,5);assert.equal(config.selectionPolicy.zeroPassFallback,3);
  for(const tab of config.tabs) assert.equal(tab.latestLimit,5,tab.id);
});
test('rule items topped up with engagement up to 5',()=>{
  const r=run([item('rule'),item('rule'),item('engagement'),item('engagement'),item('engagement')]);
  assert.equal(r.data.items.length,5);
  assert.equal(r.data.items.filter(i=>i.selection==='engagement').length,3);
  assert.equal(r.data.items.find(i=>i.selection==='engagement').engagement.likes,100);
  assert.throws(()=>run([item('rule'),item('rule'),item('engagement'),item('engagement'),item('engagement'),item('engagement')]),/超过/);
});
test('zero rule items allows at most 3 engagement items',()=>{
  assert.equal(run([item('engagement'),item('engagement'),item('engagement')]).data.items.length,3);
  assert.throws(()=>run([item('engagement'),item('engagement'),item('engagement'),item('engagement')]),/最多 3/);
});
test('engagement items need real metrics, watch tier, no weekly rank, single tab',()=>{
  assert.throws(()=>run([item('engagement',{engagement:undefined})]),/缺少 engagement/);
  assert.throws(()=>run([item('engagement',{engagement:{likes:1.5,capturedAt:'2026-10-13T02:05:00Z',source:'x'}})]),/非负整数/);
  assert.throws(()=>run([item('engagement',{engagement:{capturedAt:'2026-10-13T02:05:00Z',source:'x'}})]),/没有任何互动数/);
  assert.throws(()=>run([item('engagement',{tier:'must-read'})]),/watch/);
  assert.throws(()=>run([item('engagement',{weeklyRanks:{'elon-musk':1}})]),/重点榜/);
  assert.throws(()=>run([item('engagement',{tabIds:['elon-musk','trillion-leaders']})]),/本 Tab/);
});
test('validator helper: legacy items without selection count as rule',()=>{
  const tab=config.tabs[0];
  assert.deepEqual(checkTabSelection(tab,config.selectionPolicy,[{eventKey:'a',tabIds:[tab.id],tier:'must-read'}]),[]);
});
test('people UI labels tiers and engagement without truncation',()=>{
  const js=fs.readFileSync(path.join(root,'people.js'),'utf8');
  assert.match(js,/热度动态/);assert.match(js,/高价值/);assert.match(js,/signal-engagement/);
  assert.doesNotMatch(js,/\.slice\(0,\s*\d+\)\s*\+\s*['"]…/);
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.signal-selection-engagement/);
});
