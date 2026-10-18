'use strict';
const {loadRegistry, findAliases} = require('./person-names');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().startsWith(value);
const https = value => {try {const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password;} catch {return false;}};

function validateCounterintuitiveLearning(config, data, now = new Date()) {
  const errors = [], fail = message => errors.push(message);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.editions)) return {errors: ['小知识数据结构无效'], editions: 0, items: 0};
  const policy = config?.counterintuitivePolicy;
  if (policy?.dailyLimit !== 5) fail('反直觉小知识每日上限应为5条');
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
  const ids = new Set(), keys = new Set(), dates = new Set(), registry = loadRegistry();
  if (data.editions.length && !Number.isFinite(Date.parse(data.updatedAt))) fail('小知识缺少真实整理时间');
  for (const edition of data.editions) {
    if (!edition || !validDate(edition.date) || edition.date > today || dates.has(edition.date) || !Array.isArray(edition.items)) {fail('小知识期次日期无效或重复'); continue;}
    dates.add(edition.date);
    if (edition.items.length > 5) fail('小知识每天最多5条');
    const coverage = edition.coverage;
    if (!coverage || !['complete','partial','failed'].includes(coverage.status) || !nonempty(coverage.note) || !Array.isArray(coverage.queries) || !Number.isFinite(Date.parse(coverage.checkedAt))) fail('小知识缺少实际覆盖与缺口');
    if (coverage?.status === 'complete' && edition.items.length !== 5) fail('不足5条须如实标记缺额');
    if (coverage?.status === 'failed' && edition.items.length) fail('已有合格条目时应记录部分完成而非整组失败');
    for (const item of edition.items) {
      if (!item || !nonempty(item.id) || ids.has(item.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.knowledgeKey || '') || keys.has(item.knowledgeKey)) {fail('小知识ID或知识点重复/无效'); continue;}
      ids.add(item.id); keys.add(item.knowledgeKey);
      if (!policy?.topics?.includes(item.topic)) fail('小知识主题不符合健康生活统计范围');
      for (const field of ['title','intuition','fact','explanation','boundary']) {
        if (!nonempty(item[field])) fail(`小知识缺少${field}`);
        if (findAliases(item[field], registry).length) fail('小知识人名须用原文');
      }
      if (!Array.isArray(item.people) || item.people.some(p => !registry.people.some(r => r.name === p?.name && r.intro === p.intro))) fail('小知识人物简介须来自登记表，可用空数组');
      if (!Array.isArray(item.sources) || !item.sources.length || item.sources.some(s => !s || !nonempty(s.label) || !nonempty(s.publisher) || !https(s.url) || !['full-text','partial','abstract'].includes(s.accessLevel) || !Number.isFinite(Date.parse(s.checkedAt)) || !(validDate(s.publishedDate) && s.publishedDate <= edition.date || s.publishedDate === null && nonempty(s.dateNote)))) fail('小知识缺少原始来源、日期边界或阅读范围');
    }
  }
  return {errors, editions: dates.size, items: ids.size};
}

// Append only new knowledge; retrying a partial day may fill remaining slots without rewriting accepted cards.
function mergeCounterintuitiveLearning(config, old, input, now = new Date()) {
  if (input?.notForPublication || !validDate(input?.date) || !Array.isArray(input.items)) throw new Error('须提供可发布的日期、items与coverage');
  const editions = structuredClone(old.editions), current = editions.find(e => e.date === input.date);
  const existing = editions.flatMap(e => e.items);
  for (const item of input.items) {
    if (!item || existing.some(e => e.id === item.id || e.knowledgeKey === item.knowledgeKey)) throw new Error('禁止覆盖既有卡片或重复知识点');
  }
  if (current) {current.items.push(...input.items); current.coverage = input.coverage;}
  else editions.push({date: input.date, items: input.items, coverage: input.coverage});
  const data = {schemaVersion: 1, updatedAt: now.toISOString(), editions};
  const result = validateCounterintuitiveLearning(config, data, now);
  if (result.errors.length) throw new Error(result.errors.join('；'));
  return data;
}
module.exports = {validateCounterintuitiveLearning, mergeCounterintuitiveLearning};
