const test = require('node:test');
const assert = require('node:assert/strict');
const { validateJournalLearning } = require('../scripts/lib/journal-learning');
const config = require('../config/learning.json');
const now = new Date('2026-10-19T00:00:00+08:00');

function fixture() {
  const coverage = Object.fromEntries(['nature', 'science'].map(id => [id, {
    date: '2026-10-19', status: id === 'nature' ? 'partial' : 'failed',
    note: '测试夹具，不是研究结论', queries: ['fixture only'], checkedAt: now.toISOString()
  }]));
  return { schemaVersion: 1, updatedAt: now.toISOString(), coverage, reviews: [{
    id: 'fixture-nature', journal: 'nature', journalName: 'Nature',
    doi: '10.1038/s41586-026-fixture', paperUrl: 'https://www.nature.com/articles/s41586-026-fixture',
    selectedDate: '2026-10-19', publishedDate: '2026-10-18', selectionKind: 'recent',
    authors: ['Tim Althoff'], people: [{name: 'Tim Althoff', intro: '行为与健康数据研究者'}],
    title: '测试题目', originalTitle: 'Fixture only', category: '生活', takeaway: '测试摘要',
    stage: '测试研究类型', accessLevel: 'abstract', accessNote: '只用于结构测试',
    summary: {problem: '问题', method: '方法', findings: '结果', statistics: '统计边界', limitations: '局限', meaning: '意义'},
    sources: [{label: '测试来源', url: 'https://www.nature.com/articles/s41586-026-fixture'}]
  }]};
}

test('one journal can publish while the other fails; old dates remain valid', () => {
  const data = fixture();
  const old = structuredClone(data.reviews[0]);
  old.id = 'fixture-old'; old.doi = '10.1038/nature-fixture-old';
  old.paperUrl = 'https://www.nature.com/articles/nature-fixture-old';
  old.selectedDate = '2026-10-18'; old.publishedDate = '2020-01-01'; old.selectionKind = 'classic';
  data.reviews.push(old);
  assert.deepEqual(validateJournalLearning(config, data, now).errors, []);
});

test('duplicate DOI, duplicate daily slot and subsidiary journal are rejected', () => {
  const repeated = fixture(); repeated.reviews.push({...repeated.reviews[0], id: 'different-id'});
  const errors = validateJournalLearning(config, repeated, now).errors.join(' ');
  assert.match(errors, /DOI/);
  const over = fixture();
  for (let n=2;n<=4;n++) {const p=structuredClone(over.reviews[0]);p.id+='-'+n;p.doi+='-'+n;p.paperUrl+='-'+n;over.reviews.push(p);}
  assert.match(validateJournalLearning(config,over,now).errors.join(' '),/每天最多3篇/);
  const child = fixture(); child.reviews[0].doi = '10.1038/s41467-026-fixture';
  assert.match(validateJournalLearning(config, child, now).errors.join(' '), /正刊/);
});

test('missing statistical explanation, wrong reading level and malformed authors are rejected', () => {
  const data = fixture();
  delete data.reviews[0].summary.statistics;
  data.reviews[0].accessLevel = 'unverified'; data.reviews[0].authors = 'not an array';
  const errors = validateJournalLearning(config, data, now).errors.join(' ');
  assert.match(errors, /statistics/); assert.match(errors, /阅读范围/); assert.match(errors, /作者/);
});

test('old paper cannot be described as recent and an empty journal cannot be complete', () => {
  const data = fixture(); data.reviews[0].publishedDate = '2020-01-01';
  data.coverage.science.status = 'complete';
  const errors = validateJournalLearning(config, data, now).errors.join(' ');
  assert.match(errors, /旧论文/); assert.match(errors, /不足3篇/);
});
