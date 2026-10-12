const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('primary pages expose news, people, tickers, ai, crypto, and earnings tabs', () => {
  for (const file of ['index.html', 'people.html', 'tickers.html', 'ai.html', 'crypto.html', 'earnings.html']) {
    const html = read(file);
    const items = [...html.matchAll(/<a href="([^"]+)" data-nav="([^"]+)"/g)].map(match => match.slice(1));
    assert.deepEqual(items, [['index.html', 'news'], ['people.html', 'people'], ['tickers.html', 'tickers'], ['ai.html', 'ai'], ['crypto.html', 'crypto'], ['earnings.html', 'earnings']]);
    assert.doesNotMatch(html, /X 情报总览|来源与评分|data-stock-tab/);
  }
  assert.doesNotMatch(read('index.html'), /role="tab"/);
  assert.match(read('earnings.html'), /data-page="earnings"/);
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

test('people intelligence has five research tabs and updated windows', () => {
  const config = JSON.parse(read('config/people-intelligence.json'));
  assert.deepEqual(config.tabs.map(tab => tab.label), ['马斯克', '黄仁勋', '特朗普', '万亿美元公司高层', '机构研报']);
  const people = config.tabs.filter(tab => tab.type === 'person');
  const collections = config.tabs.filter(tab => tab.type === 'collection');
  assert.equal(collections.length, 2);
  assert.ok(people.every(tab => tab.latestLimit === 5 && tab.latestWindowDays === 1 && tab.weeklyWindowDays === 7));
  assert.ok(collections.every(tab => tab.latestLimit === 10 && tab.weeklyLimit === 5 && tab.latestWindowDays === 30 && tab.weeklyWindowDays === 30));
  const trump = config.tabs.find(tab => tab.id === 'donald-trump');
  assert.equal(trump.handle, 'TrumpDailyPosts');
  assert.ok(trump.handles.includes('POTUS'));
});

test('legacy public routes lead to the new information architecture', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'stocks.html')), false);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'sources.html')), false);
  assert.match(read('_worker.js'), /'\/stocks\.html': '\/index\.html'/);
  assert.match(read('_worker.js'), /'\/sources\.html': '\/index\.html'/);
});

test('tickers page is equity-only seven symbols', () => {
  const config = JSON.parse(read('config/ticker-intelligence.json'));
  assert.deepEqual(config.tabs.map(tab => tab.id), ['nvda', 'mu', 'intc', 'goog', 'avgo', 'vrt', 'tsm']);
  assert.ok(config.tabs.every(tab => tab.latestLimit === 5 && tab.weeklyLimit === 5 && tab.latestWindowDays === 1 && tab.weeklyWindowDays === 7));
  assert.ok(config.tabs.every(tab => tab.assetClass !== 'crypto' && tab.assetClass !== 'crypto-token' && !tab.contractAddress));
  assert.match(read('tickers.html'), /data-page="tickers"/);
  assert.match(read('tickers.js'), /ticker-intelligence\.json/);
});

test('crypto page has board, BTC, Brew tabs with Brew contract', () => {
  const config = JSON.parse(read('config/crypto-intelligence.json'));
  assert.deepEqual(config.tabs.map(tab => tab.id), ['crypto-board', 'btc', 'brew']);
  assert.equal(config.tabs[0].label, '加密板块讯息');
  assert.equal(config.tabs[0].latestLimit, 10);
  const brew = config.tabs.find(tab => tab.id === 'brew');
  assert.equal(brew.assetClass, 'crypto-token');
  assert.equal(brew.contractAddress.toLowerCase(), '0xfa6d9b504848606eb9aec04ccc161d169b3f2159');
  assert.equal(brew.latestWindowDays, 7);
  assert.equal(brew.weeklyWindowDays, 7);
  assert.equal(config.tabs.find(tab => tab.id === 'btc').assetClass, 'crypto');
  assert.ok(config.tabs.every(tab => tab.latestWindowDays === 7 && tab.weeklyWindowDays === 7));
  assert.equal(config.tabs.find(tab => tab.id === 'crypto-board').latestLimit, 10);
  assert.match(read('crypto.html'), /data-page="crypto"/);
  assert.match(read('crypto.js'), /crypto-intelligence\.json/);
});

test('ai page has OPENAI ANTHROPIC GOOG and 其他 tabs', () => {
  const config = JSON.parse(read('config/ai-intelligence.json'));
  assert.deepEqual(config.tabs.map(tab => tab.id), ['openai', 'anthropic', 'goog-ai', 'ai-others']);
  assert.equal(config.tabs.find(t => t.id === 'ai-others').latestLimit, 10);
  assert.ok(['openai', 'anthropic', 'goog-ai'].every(id => {
    const t = config.tabs.find(x => x.id === id);
    return t.latestLimit === 5 && t.latestWindowDays === 1 && t.weeklyWindowDays === 7;
  }));
  assert.match(read('ai.html'), /data-page="ai"/);
  assert.match(read('ai.js'), /ai-intelligence\.json/);
  assert.match(read('docs/AI_INTELLIGENCE.md'), /与具体个股 GOOG 边界/);
});

test('stock brief cards no longer expose 证据与筛选依据 UI', () => {
  assert.doesNotMatch(read('briefs.js'), /证据与筛选依据/);
  assert.match(read('briefs.js'), /原文链接/);
});

test('earnings page loads company blurbs for calendar symbols', () => {
  const blurbs = JSON.parse(read('config/company-blurbs.json')).blurbs;
  const calendar = JSON.parse(read('data/earnings-calendar.json'));
  const symbols = new Set();
  for (const week of calendar.weeks || []) for (const day of week.days || []) for (const item of day.items || []) symbols.add(item.symbol);
  assert.ok(symbols.size > 0);
  for (const symbol of symbols) assert.equal(typeof blurbs[symbol], 'string');
  assert.match(read('earnings.js'), /company-blurbs\.json/);
  assert.match(read('earnings.js'), /earnings-blurb/);
});
