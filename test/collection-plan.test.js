const test = require('node:test');
const assert = require('node:assert/strict');
const {createPlan} = require('../scripts/collection-plan');

test('每次定时触发按侧边栏 Tab 形成隔离批次', () => {
  const plan = createPlan('2026-10-19T15:00:00+08:00');
  assert.deepEqual(plan.batches.map(item => item.id), ['news','people','tickers','ai','learning','macro','earnings']);
  assert.ok(plan.batches.every(item => item.isolated));
  assert.deepEqual(plan.batches.find(item => item.id === 'news').subtasks, ['discovery','source-verification','counter-evidence']);
  assert.equal(plan.batches.find(item => item.id === 'learning').action, 'skip');
  assert.equal(plan.batches.find(item => item.id === 'macro').action, 'check-due');
});

test('20:30 批次单独生成每日学习任务', () => {
  const plan = createPlan('2026-10-19T20:30:00+08:00');
  assert.equal(plan.batches.find(item => item.id === 'learning').action, 'run');
  assert.deepEqual(plan.batches.find(item=>item.id==='learning').components,{papers:false,basics:true,counterintuitive:true});
});

test('08:00 only runs journal learning on weekdays',()=>{
  const batch=createPlan('2026-10-19T08:00:00+08:00').batches.find(b=>b.id==='learning');
  assert.equal(batch.action,'run');
  assert.deepEqual(batch.components,{papers:true,basics:false,counterintuitive:false});
});

test('周末只运行08:00且学习跟随唯一批次',()=>{
  const morning=createPlan('2026-10-18T08:00:00+08:00');
  assert.equal(morning.scheduled,true);
  assert.equal(morning.batches.find(b=>b.id==='learning').action,'run');
  assert.deepEqual(morning.batches.find(b=>b.id==='learning').components,{papers:true,basics:true,counterintuitive:true});
  const evening=createPlan('2026-10-18T20:30:00+08:00');
  assert.equal(evening.scheduled,false);
  assert.ok(evening.batches.every(b=>b.action==='skip'));
});

test('拒绝非配置时点，防止把临时运行误作定时期次', () => {
  assert.throws(() => createPlan('2026-10-18T16:00:00+08:00'), /不支持的批次/);
});
