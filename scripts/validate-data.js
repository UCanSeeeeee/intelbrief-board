#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { ROOT, readJson, postIdFromUrl, sourceIndex } = require("./lib/x-data");
const { prepareBrief } = require("./lib/stock-brief");

function fail(message) {
  console.error(`[validate-data] ${message}`);
  process.exitCode = 1;
}

const raw = readJson(path.join(ROOT, "data", "raw", "x-posts.json"));
const intelligence = readJson(path.join(ROOT, "data", "x-intelligence.json"));
const ids = new Set();

for (const [index, post] of (raw.posts || []).entries()) {
  if (!/^\d+$/.test(String(post.id))) fail(`raw.posts[${index}] invalid id`);
  if (ids.has(String(post.id))) fail(`duplicate post id ${post.id}`);
  ids.add(String(post.id));
  if (postIdFromUrl(post.url) !== String(post.id)) fail(`post ${post.id} URL does not match id`);
  if (!post.author?.username) fail(`post ${post.id} missing author username`);
  if (!post.text) fail(`post ${post.id} missing text`);
  if (Number.isNaN(Date.parse(post.createdAt))) fail(`post ${post.id} invalid createdAt`);
}

for (const [index, post] of (intelligence.posts || []).entries()) {
  const score = post.credibility?.overall;
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    fail(`intelligence.posts[${index}] invalid credibility score`);
  }
}

const editions = readJson(path.join(ROOT, 'data/stock-briefs/index.json')).editions;
const editionIds = new Set();
for (const entry of editions) {
  try {
    if (!/^(?:\d{4}-\d{2}-\d{2}-(?:0900|1600|2100)|manual-[a-f0-9-]{36})$/.test(entry.id) || entry.file !== `${entry.id}.json`) throw new Error('invalid archive path');
    if (editionIds.has(entry.id)) throw new Error('duplicate edition');
    editionIds.add(entry.id);
    const brief = readJson(path.join(ROOT, 'data/stock-briefs', entry.file));
    const checked = prepareBrief(brief, { now: new Date(brief.generatedAt), sources: sourceIndex() });
    for (const key of ['id','scheduledFor','generatedAt','status','counts']) {
      if (JSON.stringify(entry[key]) !== JSON.stringify(checked[key])) throw new Error(`manifest mismatch: ${key}`);
    }
    if (Date.parse(brief.generatedAt) > Date.now()) throw new Error('future generatedAt');
  } catch (error) { fail(`edition ${entry.id}: ${error.message}`); }
}

const peopleConfig = readJson(path.join(ROOT, 'config/people-intelligence.json'));
const peopleData = readJson(path.join(ROOT, 'data/people-intelligence.json'));
const peopleTabs = new Map((peopleConfig.tabs || []).map(tab => [tab.id, tab]));
const eventKeys = new Set();
const evidenceUrls = new Set();
for (const [index, item] of (peopleData.items || []).entries()) {
  if (!item.eventKey || eventKeys.has(item.eventKey)) fail(`people.items[${index}] invalid or duplicate eventKey`);
  eventKeys.add(item.eventKey);
  if (!Array.isArray(item.tabIds) || !item.tabIds.length || item.tabIds.some(id => !peopleTabs.has(id))) fail(`people.items[${index}] invalid tabIds`);
  if (!/^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(item.url || '') || evidenceUrls.has(item.url)) fail(`people.items[${index}] invalid or duplicate X evidence`);
  evidenceUrls.add(item.url);
  if (Number.isNaN(Date.parse(item.publishedAt))) fail(`people.items[${index}] invalid publishedAt`);
  if (item.verification !== 'collector-report') fail(`people.items[${index}] must retain collector-report verification`);
  for (const [tabId, rank] of Object.entries(item.weeklyRanks || {})) if (!item.tabIds.includes(tabId) || !Number.isInteger(rank) || rank < 1 || rank > 5) fail(`people.items[${index}] invalid weekly rank`);
}
const referenceTime = peopleData.cutoff ? Date.parse(peopleData.cutoff) : Date.now();
for (const tab of peopleTabs.values()) {
  const tabItems = (peopleData.items || []).filter(item => item.tabIds.includes(tab.id));
  if (tabItems.filter(item => Date.parse(item.publishedAt) >= referenceTime - 86400000).length > tab.latestLimit) fail(`${tab.label} exceeds latestLimit`);
  const ranks = tabItems.map(item => item.weeklyRanks?.[tab.id]).filter(rank => rank != null);
  if (ranks.length > tab.weeklyLimit || new Set(ranks).size !== ranks.length) fail(`${tab.label} invalid weekly ranking`);
}


const tickerConfig = readJson(path.join(ROOT, 'config/ticker-intelligence.json'));
const tickerData = readJson(path.join(ROOT, 'data/ticker-intelligence.json'));
const tickerTabs = new Map((tickerConfig.tabs || []).map(tab => [tab.id, tab]));
const tickerKeys = new Set();
const tickerUrls = new Set();
for (const [index, item] of (tickerData.items || []).entries()) {
  if (!item.eventKey || tickerKeys.has(item.eventKey)) fail(`tickers.items[${index}] invalid or duplicate eventKey`);
  tickerKeys.add(item.eventKey);
  if (!Array.isArray(item.tabIds) || !item.tabIds.length || item.tabIds.some(id => !tickerTabs.has(id))) fail(`tickers.items[${index}] invalid tabIds`);
  if (!/^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(item.url || '') || tickerUrls.has(item.url)) fail(`tickers.items[${index}] invalid or duplicate X evidence`);
  tickerUrls.add(item.url);
  if (Number.isNaN(Date.parse(item.publishedAt))) fail(`tickers.items[${index}] invalid publishedAt`);
  if (item.verification !== 'collector-report') fail(`tickers.items[${index}] must retain collector-report verification`);
  for (const [tabId, rank] of Object.entries(item.weeklyRanks || {})) if (!item.tabIds.includes(tabId) || !Number.isInteger(rank) || rank < 1 || rank > 5) fail(`tickers.items[${index}] invalid weekly rank`);
}
const tickerReference = tickerData.cutoff ? Date.parse(tickerData.cutoff) : Date.now();
for (const tab of tickerTabs.values()) {
  const tabItems = (tickerData.items || []).filter(item => item.tabIds.includes(tab.id));
  if (tabItems.filter(item => Date.parse(item.publishedAt) >= tickerReference - 86400000).length > tab.latestLimit) fail(`${tab.label} exceeds latestLimit`);
  const ranks = tabItems.map(item => item.weeklyRanks?.[tab.id]).filter(rank => rank != null);
  if (ranks.length > tab.weeklyLimit || new Set(ranks).size !== ranks.length) fail(`${tab.label} invalid weekly ranking`);
}
const brew = tickerTabs.get('brew');
if (!brew || brew.assetClass !== 'crypto-token' || !/^0x[a-fA-F0-9]{40}$/.test(brew.contractAddress || '')) fail('brew tab must be crypto-token with valid contractAddress');
if (!tickerTabs.get('btc') || tickerTabs.get('btc').assetClass !== 'crypto') fail('btc tab must be crypto assetClass');

const guidance = readJson(path.join(ROOT, 'config/research-guidance.json'));
if (JSON.stringify(guidance.priorityOrder) !== JSON.stringify(['半导体','电力','AI 落地'])) fail('research guidance priority order changed unexpectedly');
for (const key of ['knowledgeBase','collectionSop']) {
  const file = path.resolve(ROOT, guidance[key] || '');
  if (!file.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(file)) fail(`research guidance missing ${key}`);
  else if (fs.readFileSync(file,'utf8').length < 1000) fail(`research guidance ${key} is unexpectedly empty`);
}

const earningsConfig = readJson(path.join(ROOT, 'config/earnings-calendar.json'));
const earnings = readJson(path.join(ROOT, 'data/earnings-calendar.json'));
if (earningsConfig?.source?.endpoint !== 'https://api.nasdaq.com/api/calendar/earnings') fail('earnings source endpoint unexpected');
if (!Array.isArray(earnings.weeks) || earnings.weeks.length < 3) fail('earnings calendar needs last/current/next weeks');
for (const week of earnings.weeks) {
  if (!['last','current','next'].includes(week.id)) fail(`earnings week id invalid: ${week.id}`);
  if (!Array.isArray(week.days)) fail(`earnings week ${week.id} missing days`);
  for (const [index, day] of week.days.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) fail(`earnings.${week.id}.days[${index}] invalid date`);
    if (!Array.isArray(day.items)) fail(`earnings.${week.id}.days[${index}] missing items`);
    for (const [j, item] of day.items.entries()) {
      if (!item.symbol || !item.timeLabel) fail(`earnings.${week.id}.days[${index}].items[${j}] incomplete`);
    }
  }
}

{
  const todayBj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const bandOf = (s) => (s < 60 ? 'miss' : s < 70 ? 'inline' : s < 90 ? 'beat' : 'smash');
  for (const week of earnings.weeks || []) {
    for (const day of week.days || []) {
      for (const item of day.items || []) {
        const r = item.result || { status: 'unreviewed' };
        const where = `earnings ${day.date} ${item.symbol}`;
        if (day.date < todayBj && r.status === 'unreviewed') fail(`${where}: 已过披露日但未评价，须评分或标 unknown`);
        if (r.status === 'scored') {
          if (!Number.isFinite(r.score) || r.score < 0 || r.score > 100) fail(`${where}: 分数须为 0-100`);
          else if (r.band !== bandOf(r.score)) fail(`${where}: 档位 ${r.band} 与分数 ${r.score} 不一致`);
          if (!r.summary || !Array.isArray(r.sources) || !r.sources.length) fail(`${where}: 缺总结或来源`);
        }
        if (r.status === 'unknown' && !r.summary) fail(`${where}: unknown 须写明原因`);
      }
    }
  }
}

{
  const covFile = path.join(ROOT, 'data/search-coverage.json');
  if (fs.existsSync(covFile)) {
    const cov = readJson(covFile);
    if (!Array.isArray(cov.records)) fail('search-coverage records missing');
    for (const r of cov.records || []) if (!r.jobId || !r.page || !(Date.parse(r.start) < Date.parse(r.end)) || !Array.isArray(r.queries)) fail(`search-coverage record invalid: ${r.jobId}`);
  }
}

if (!process.exitCode) {
  console.log(`[validate-data] OK: ${ids.size} raw posts, ${(intelligence.posts || []).length} display posts`);
  console.log(`[validate-data] OK: ${editionIds.size} stock brief editions`);
  console.log(`[validate-data] OK: ${peopleTabs.size} people tabs, ${eventKeys.size} selected events`);
  console.log(`[validate-data] OK: ${tickerTabs.size} ticker tabs, ${tickerKeys.size} selected events`);
  console.log('[validate-data] OK: project research knowledge and Grok SOP');
  console.log(`[validate-data] OK: earnings calendar ${earnings.weeks?.length||0} weeks, ${earnings.counts?.important||0} important / ${earnings.counts?.raw||0} raw`);
}
