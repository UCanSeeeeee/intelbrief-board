const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = import('../market-sentiment.mjs');
const now = new Date('2026-10-19T00:00:00Z');
const raw = () => ({ fear_and_greed: { score: 18, rating: 'extreme fear', timestamp: '2026-10-16T23:59:49Z', previous_close: 32, previous_1_week: null, previous_1_month: 27 } });
test('zero is valid; missing values and original time are preserved', async () => {
  const { normalizeCNN, validSnapshot } = await model;
  const input = raw(); input.fear_and_greed.score = 0;
  const data = normalizeCNN(input, 'mirror', now);
  assert.equal(data.score, 0); assert.equal(data.previous.week, null); assert.equal(data.previous.year, null);
  assert.equal(data.timestamp, input.fear_and_greed.timestamp); assert.equal(data.fetchedAt, now.toISOString());
  assert.equal(validSnapshot(data, now), true);
});
test('reject invalid scores, labels and future timestamps', async () => {
  const { normalizeCNN } = await model;
  for (const score of [null, undefined, '18', -1, 101, NaN, Infinity]) {
    const input = raw(); input.fear_and_greed.score = score;
    assert.throws(() => normalizeCNN(input, 'cnn', now));
  }
  assert.throws(() => normalizeCNN({ fear_and_greed: { ...raw().fear_and_greed, rating: 'buy' } }, 'cnn', now));
  assert.throws(() => normalizeCNN({ fear_and_greed: { ...raw().fear_and_greed, timestamp: '2027-01-01T00:00:00Z' } }, 'cnn', now));
});
test('fixed fallback records CNN failure and mirror identity', async () => {
  const { fetchSentiment, CNN_DATA, MIRROR_DATA } = await model; const seen = [];
  const data = await fetchSentiment({ fetcher: async url => { seen.push(url); return url === CNN_DATA ? new Response('blocked', { status: 418 }) : Response.json(raw()); } });
  assert.deepEqual(seen, [CNN_DATA, MIRROR_DATA]); assert.equal(data.source.method, 'mirror');
  assert.deepEqual(data.retrieval.errors, [{ source: 'cnn', message: 'HTTP 418' }]);
});
test('failed sources cannot fabricate neutral or zero values', async () => {
  const { fetchSentiment } = await model;
  await assert.rejects(fetchSentiment({ fetcher: async () => new Response('unavailable', { status: 503 }) }));
});
