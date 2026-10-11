const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('primary pages expose exactly two sidebar tabs', () => {
  for (const file of ['index.html', 'people.html']) {
    const html = read(file);
    const items = [...html.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"/g)].map(match => match.slice(1));
    assert.deepEqual(items, [['index.html', 'news'], ['people.html', 'people']]);
    assert.doesNotMatch(html, /X 情报总览|来源与评分|data-stock-tab/);
  }
  assert.doesNotMatch(read('index.html'), /role="tab"/);
});

test('news is the home page and people is an independent page', () => {
  const news = read('index.html');
  const people = read('people.html');
  assert.match(news, /<body data-page="news">/);
  assert.match(news, /id="brief-focus"/);
  assert.match(news, /id="brief-insights"/);
  assert.match(people, /<body data-page="people">/);
  assert.match(people, /id="people-selector"/);
  assert.match(people, /role="tablist"/);
  assert.match(people, /id="person-detail"/);
});

test('people intelligence has five research tabs and the collection limit is ten', () => {
  const config = JSON.parse(read('config/people-intelligence.json'));
  assert.deepEqual(config.tabs.map(tab => tab.label), ['马斯克', '黄仁勋', '特朗普', '万亿美元公司高层', '机构研报']);
  const collections = config.tabs.filter(tab => tab.type === 'collection');
  assert.equal(collections.length, 2);
  assert.ok(collections.every(tab => tab.latestLimit === 10 && tab.weeklyLimit === 5));
});

test('legacy public routes lead to the new information architecture', () => {
  assert.match(read('stocks.html'), /people\.html/);
  assert.match(read('stocks.html'), /index\.html/);
  assert.match(read('sources.html'), /url=index\.html/);
});
