const test = require('node:test');
const assert = require('node:assert/strict');
const { fromNewYork, macroTime, earningsState } = require('../calendar-time');

test('New York event times use the event date and DST, not a fixed offset', () => {
  for (const [date, utc] of [
    ['2026-03-06', '13:30'], ['2026-03-09', '12:30'],
    ['2026-10-30', '12:30'], ['2026-11-02', '13:30']
  ]) assert.equal(fromNewYork(date, '08:30').toISOString(), `${date}T${utc}:00.000Z`);
  assert.match(macroTime({ date: '2026-10-14', timeEt: '08:30 ET' }), /2026\/10\/14 20:30/);
  assert.match(macroTime({ date: '2026-12-10', timeEt: '08:30 ET' }), /2026\/12\/10 21:30/);
  assert.match(macroTime({ date: '2026-10-14', timeEt: '14:00 / 14:30 ET' }), /2026\/10\/15 02:00 \/ 2026\/10\/15 02:30/);
});

test('unknown or invalid event times never invent a Beijing timestamp', () => {
  assert.match(macroTime({ date: '2026-10-14', timeEt: '盘后' }), /北京时间待具体时刻确认/);
  assert.match(macroTime({ date: '2026-10-14', timeEt: '约 08:30' }), /北京时间约/);
  for (const [date, clock] of [['2026-03-08', '02:30'], ['2026-02-30', '08:30'], ['2026-10-14', '25:30'], ['invalid', '08:30']]) {
    assert.equal(fromNewYork(date, clock), null);
  }
});

test('earnings are pending before disclosure; elapsed schedule alone is not disclosure evidence', () => {
  const item = { timeCode: 'bmo', result: { status: 'unreviewed', score: null } };
  // Already Monday in Beijing, still Sunday in New York.
  assert.equal(earningsState(item, '2026-10-12', new Date('2026-10-12T01:00:00+08:00')), '待披露');
  assert.equal(earningsState(item, '2026-10-12', new Date('2026-10-12T13:29:00Z')), '待披露');
  assert.equal(earningsState(item, '2026-10-12', new Date('2026-10-12T13:30:00Z')), '披露状态待核验');
  assert.equal(earningsState({ ...item, timeCode: 'amc' }, '2026-10-12', new Date('2026-10-12T19:59:00Z')), '待披露');
  assert.equal(earningsState({ ...item, timeCode: 'amc' }, '2026-10-12', new Date('2026-10-12T20:00:00Z')), '披露状态待核验');
  assert.equal(earningsState(item, '2026-10-09', new Date('2026-10-12T13:00:00Z')), '披露状态待核验');
});

test('earnings evidence distinguishes missing results, pending scores, unknown and real zero', () => {
  const state = result => earningsState({ result }, '2026-10-12', new Date('2026-10-12T13:00:00Z'));
  assert.equal(state({ status: 'disclosed' }), '结果待补录');
  assert.equal(state({ status: 'pending-score' }), '待评分');
  assert.equal(state({ disclosureConfirmed: true, factsComplete: true }), '待评分');
  assert.equal(state({ status: 'unknown', score: null }), '暂无法评分 · 披露与结果待核验');
  assert.equal(state({ status: 'scored', score: 0, band: 'miss' }), '不及预期 · 0分');
  assert.equal(state({ status: 'scored', score: null }), '待披露');
});
