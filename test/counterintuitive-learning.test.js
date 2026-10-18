const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config/learning.json');
const {validateCounterintuitiveLearning: validate, mergeCounterintuitiveLearning: merge} = require('../scripts/lib/counterintuitive-learning');
const now = new Date('2026-10-19T12:00:00+08:00');
const blank = () => ({schemaVersion:1, updatedAt:null, editions:[]});
const coverage = status => ({status, note:'测试夹具，不是研究记录', queries:[], checkedAt:now.toISOString()});
const item = id => ({
  id, knowledgeKey:id, topic:'统计', title:'测试知识点', intuition:'测试直觉', fact:'测试证据',
  explanation:'测试解释', boundary:'测试边界', people:[],
  sources:[{label:'测试来源', publisher:'测试机构', url:'https://example.org/fixture', publishedDate:null, dateNote:'测试未注明日期', accessLevel:'abstract', checkedAt:now.toISOString()}]
});
const input = (items, status='partial', date='2026-10-19') => ({date, items, coverage:coverage(status)});

test('empty foundation is valid without claiming an update', () => {
  assert.deepEqual(validate(config, blank(), now).errors, []);
});

test('five daily items complete a day; fewer do not', () => {
  const five = merge(config, blank(), input(['a','b','c','d','e'].map(item),'complete'), now);
  assert.equal(five.editions[0].items.length,5);
  assert.throws(() => merge(config,blank(),input([item('a')],'complete'),now),/缺额/);
  assert.throws(() => merge(config,blank(),input(['a','b','c','d','e','f'].map(item)),now),/最多5条/);
});

test('partial-day retry appends without mutating accepted history; duplicates fail', () => {
  const old = merge(config,blank(),input([item('a')]),now);
  const before = structuredClone(old);
  const filled = merge(config,old,input(['b','c','d','e'].map(item),'complete'),now);
  assert.deepEqual(old,before);
  assert.deepEqual(filled.editions[0].items[0],old.editions[0].items[0]);
  assert.throws(() => merge(config,old,input([item('a')],'partial','2026-10-18'),now),/重复知识点/);
});

test('failure preserves previous content; missing evidence or boundary is rejected', () => {
  const old = merge(config,blank(),input([item('a')],'partial','2026-10-18'),now);
  const failed = merge(config,old,input([],'failed'),now);
  assert.equal(failed.editions[0].items.length,1);
  assert.equal(failed.editions[1].items.length,0);
  const incomplete = item('b'); delete incomplete.boundary; incomplete.sources=[];
  assert.throws(() => merge(config,old,input([incomplete]),now),/boundary.*来源/);
});
