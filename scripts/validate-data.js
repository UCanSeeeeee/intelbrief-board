#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { ROOT, readJson, postIdFromUrl, sourceIndex } = require("./lib/x-data");
const { prepareBrief } = require("./lib/stock-brief");
try { require('./lib/reading-board').readBoard(ROOT); } catch(error) { fail(error.message); }

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

const { checkTabSelection } = require('./lib/selection-policy');
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
  const latestWindow = Number(tab.latestWindowDays) || 1;
  for (const msg of checkTabSelection(tab, peopleConfig.selectionPolicy, tabItems.filter(item => Date.parse(item.publishedAt) >= referenceTime - latestWindow * 86400000))) fail(`people ${msg}`);
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
const equityIds = ['nvda','mu','intc','goog','avgo','vrt','tsm'];
if ([...tickerTabs.keys()].sort().join() !== equityIds.slice().sort().join()) fail('ticker tabs must be equity-only NVDA/MU/INTC/GOOG/AVGO/VRT/TSM');
for (const tab of tickerTabs.values()) if (tab.assetClass === 'crypto' || tab.assetClass === 'crypto-token' || tab.contractAddress) fail(`${tab.id} crypto fields not allowed on equity ticker page`);


const cryptoConfig = readJson(path.join(ROOT, 'config/crypto-intelligence.json'));
const cryptoData = readJson(path.join(ROOT, 'data/crypto-intelligence.json'));
const cryptoTabs = new Map((cryptoConfig.tabs || []).map(tab => [tab.id, tab]));
if ([...cryptoTabs.keys()].join() !== 'crypto-board,btc,brew') fail('crypto tabs must be crypto-board, btc, brew in that config order');
const brewTab = cryptoTabs.get('brew');
if (!brewTab || brewTab.assetClass !== 'crypto-token' || !/^0x[a-fA-F0-9]{40}$/i.test(brewTab.contractAddress || '')) fail('brew must be crypto-token with valid contractAddress');
if (cryptoTabs.get('btc')?.assetClass !== 'crypto') fail('btc must be crypto assetClass');
if (cryptoTabs.get('crypto-board')?.assetClass !== 'crypto-board') fail('crypto-board assetClass required');
const cryptoKeys = new Set();
const cryptoUrls = new Set();
for (const [index, item] of (cryptoData.items || []).entries()) {
  if (!item.eventKey || cryptoKeys.has(item.eventKey)) fail(`crypto.items[${index}] invalid or duplicate eventKey`);
  cryptoKeys.add(item.eventKey);
  if (!Array.isArray(item.tabIds) || !item.tabIds.length || item.tabIds.some(id => !cryptoTabs.has(id))) fail(`crypto.items[${index}] invalid tabIds`);
  if (!/^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(item.url || '') || cryptoUrls.has(item.url)) fail(`crypto.items[${index}] invalid or duplicate X evidence`);
  cryptoUrls.add(item.url);
  if (Number.isNaN(Date.parse(item.publishedAt))) fail(`crypto.items[${index}] invalid publishedAt`);
  if (item.verification !== 'collector-report') fail(`crypto.items[${index}] must retain collector-report verification`);
  for (const [tabId, rank] of Object.entries(item.weeklyRanks || {})) if (!item.tabIds.includes(tabId) || !Number.isInteger(rank) || rank < 1 || rank > 5) fail(`crypto.items[${index}] invalid weekly rank`);
}
const cryptoReference = cryptoData.cutoff ? Date.parse(cryptoData.cutoff) : Date.now();
for (const tab of cryptoTabs.values()) {
  const tabItems = (cryptoData.items || []).filter(item => item.tabIds.includes(tab.id));
  const latestDays = Number(tab.latestWindowDays) || 1;
  if (tabItems.filter(item => Date.parse(item.publishedAt) >= cryptoReference - latestDays * 86400000).length > tab.latestLimit) fail(`${tab.label} exceeds latestLimit`);
  const ranks = tabItems.map(item => item.weeklyRanks?.[tab.id]).filter(rank => rank != null);
  if (ranks.length > tab.weeklyLimit || new Set(ranks).size !== ranks.length) fail(`${tab.label} invalid weekly ranking`);
}


const aiConfig = readJson(path.join(ROOT, 'config/ai-intelligence.json'));
const aiData = readJson(path.join(ROOT, 'data/ai-intelligence.json'));
const aiTabs = new Map((aiConfig.tabs || []).map(tab => [tab.id, tab]));
if ([...aiTabs.keys()].join() !== 'openai,anthropic,goog-ai,ai-others') fail('ai tabs must be openai,anthropic,goog-ai,ai-others');
const aiKeys = new Set();
const aiUrls = new Set();
for (const [index, item] of (aiData.items || []).entries()) {
  if (!item.eventKey || aiKeys.has(item.eventKey)) fail(`ai.items[${index}] invalid or duplicate eventKey`);
  aiKeys.add(item.eventKey);
  if (!Array.isArray(item.tabIds) || !item.tabIds.length || item.tabIds.some(id => !aiTabs.has(id))) fail(`ai.items[${index}] invalid tabIds`);
  if (!/^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(item.url || '') || aiUrls.has(item.url)) fail(`ai.items[${index}] invalid or duplicate X evidence`);
  aiUrls.add(item.url);
  if (Number.isNaN(Date.parse(item.publishedAt))) fail(`ai.items[${index}] invalid publishedAt`);
  if (item.verification !== 'collector-report') fail(`ai.items[${index}] must retain collector-report verification`);
  for (const [tabId, rank] of Object.entries(item.weeklyRanks || {})) if (!item.tabIds.includes(tabId) || !Number.isInteger(rank) || rank < 1 || rank > 5) fail(`ai.items[${index}] invalid weekly rank`);
}
const aiReference = aiData.cutoff ? Date.parse(aiData.cutoff) : Date.now();
for (const tab of aiTabs.values()) {
  const tabItems = (aiData.items || []).filter(item => item.tabIds.includes(tab.id));
  const latestDays = Number(tab.latestWindowDays) || 1;
  if (tabItems.filter(item => Date.parse(item.publishedAt) >= aiReference - latestDays * 86400000).length > tab.latestLimit) fail(`${tab.label} exceeds latestLimit`);
  const ranks = tabItems.map(item => item.weeklyRanks?.[tab.id]).filter(rank => rank != null);
  if (ranks.length > tab.weeklyLimit || new Set(ranks).size !== ranks.length) fail(`${tab.label} invalid weekly ranking`);
}

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


{
  const blurbsFile = readJson(path.join(ROOT, 'config/company-blurbs.json'));
  const blurbs = blurbsFile.blurbs || {};
  for (const week of earnings.weeks || []) {
    for (const day of week.days || []) {
      for (const item of day.items || []) {
        if (!blurbs[item.symbol] || typeof blurbs[item.symbol] !== 'string') fail(`company blurb missing for ${item.symbol}`);
      }
    }
  }
}


{
  const macro = readJson(path.join(ROOT, 'data/macro-events.json'));
  const macroCfg = readJson(path.join(ROOT, 'config/macro-events.json'));
  if (macro.year !== 2026) fail(`macro year unexpected: ${macro.year}`);
  if (!Array.isArray(macro.quarters) || macro.quarters.length !== 4) fail('macro needs 4 quarters');
  const ids = new Set();
  let total = 0;
  for (const q of macro.quarters) {
    if (!/^q[1-4]$/.test(q.id) || !Array.isArray(q.events)) fail(`macro quarter invalid: ${q.id}`);
    for (const e of q.events) {
      total++;
      if (!e.id || ids.has(e.id)) fail(`macro event id invalid/dup: ${e.id}`);
      ids.add(e.id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !e.title || !e.category) fail(`macro event fields: ${e.id}`);
      if (!Array.isArray(e.sources) || !e.sources.length || e.sources.some(s => !s.name)) fail(`macro sources: ${e.id}`);
    }
  }
  if (macro.counts?.total !== total) fail(`macro counts.total mismatch ${macro.counts?.total} vs ${total}`);
  if (!macroCfg.refresh?.notTiedToBriefSlots) fail('macro refresh must stay off brief slots');
  console.log(`[validate-data] OK: macro events ${total} across ${macro.quarters.length} quarters`);
}


{
  const shortsConfig = readJson(path.join(ROOT, 'config/shorts-intelligence.json'));
  const shortsData = readJson(path.join(ROOT, 'data/shorts-intelligence.json'));
  const shortsTabs = new Set((shortsConfig.tabs || []).map(tab => tab.id));
  if (shortsTabs.size !== 3) fail('shorts needs 3 sector tabs');
  const expected = ['semiconductor-shorts', 'power-shorts', 'ai-adoption-shorts'];
  if ([...shortsTabs].join() !== expected.join()) fail('shorts tab order/ids mismatch');
  for (const tab of shortsConfig.tabs) {
    if (tab.latestWindowDays !== 7 || tab.weeklyWindowDays !== 7) fail(`shorts window: ${tab.id}`);
    if (tab.latestLimit > 5 || tab.weeklyLimit > 5) fail(`shorts limit: ${tab.id}`);
  }
  const shortsKeys = new Set();
  for (const item of shortsData.items || []) {
    if (!item.eventKey || shortsKeys.has(item.eventKey)) fail(`shorts eventKey: ${item.eventKey}`);
    shortsKeys.add(item.eventKey);
    if (!Array.isArray(item.tabIds) || !item.tabIds.every(id => shortsTabs.has(id))) fail(`shorts tabIds: ${item.eventKey}`);
    if (!/^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+$/.test(item.url || '')) fail(`shorts url: ${item.eventKey}`);
  }
  console.log(`[validate-data] OK: ${shortsTabs.size} shorts tabs, ${shortsKeys.size} selected events`);
}

{
  const contract=require('../update-receipt');
  const directory=path.join(ROOT,'data/update-receipts');
  for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.json'))){
    const receipt=readJson(path.join(directory,file));
    if(receipt.schemaVersion!==2)continue; // frozen legacy receipts
    try{contract.validate(receipt,receipt);if(file!==receipt.requestId+'.json')throw new Error('文件名与编号不符');}
    catch(error){fail(`manual receipt ${file}: ${error.message}`);}
  }
}


{
  const opsDir = path.join(ROOT, 'data/ops-runs');
  if (fs.existsSync(opsDir)) {
    const ops = require('./lib/ops-run');
    for (const file of fs.readdirSync(opsDir).filter(f => f.endsWith('.json'))) {
      const data = readJson(path.join(opsDir, file));
      if (file === 'latest.json') {
        if (!data.period || !data.status || !data.file) fail(`ops-runs latest.json incomplete`);
        continue;
      }
      if (data.schemaVersion !== 1) fail(`ops-runs ${file}: unsupported schema`);
      try { ops.assertPeriod(data.period); } catch (e) { fail(`ops-runs ${file}: ${e.message}`); }
      if (!ops.RUN_STATUS.includes(data.status)) fail(`ops-runs ${file}: bad status`);
      if (!Array.isArray(data.stages) || data.stages.length !== ops.STAGES.length) fail(`ops-runs ${file}: stages`);
      if (file !== data.period + '.json') fail(`ops-runs ${file}: filename must match period`);
    }
  }
}

// Person names: original form in card text + registry intros (user rule 2026-10-13).
// Applies to current and archived published cards; recorded queries and quotes are exempt.
let personCards = 0;
try {
  const names = require('./lib/person-names');
  const registry = names.loadRegistry();
  const files = ['data/reading-board.json','data/people-intelligence.json','data/ticker-intelligence.json','data/ai-intelligence.json','data/crypto-intelligence.json',...fs.readdirSync(path.join(ROOT,'data/stock-briefs')).filter(f=>f.endsWith('.json')&&f!=='index.json').map(f=>'data/stock-briefs/'+f)];
  const isCard = o => o && typeof o === 'object' && !Array.isArray(o) && typeof o.title === 'string' && typeof o.fact === 'string' && (Array.isArray(o.sources) || typeof o.url === 'string');
  for (const rel of files) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    const walk = (node, where) => {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${where}[${i}]`));
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`);
      if (!isCard(node)) return;
      personCards++;
      for (const field of names.CARD_FIELDS) { const hit = names.findAliases(node[field], registry); if (hit.length) fail(`${rel} ${where}.${field}: 人名中文音译 ${hit.join('、')}，需改为原文写法`); }
      if (!Array.isArray(node.people)) fail(`${rel} ${where}: 缺少 people 人物简介列表`);
      else if (!names.samePeople(node.people, names.mentionedPeople(node, registry))) fail(`${rel} ${where}: people 与人物登记表不一致（运行 node scripts/normalize-person-names.js）`);
    };
    walk(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')), '');
  }
} catch (error) { fail(`person registry: ${error.message}`); }

if (!process.exitCode) {
  console.log(`[validate-data] OK: ${ids.size} raw posts, ${(intelligence.posts || []).length} display posts`);
  console.log(`[validate-data] OK: ${editionIds.size} stock brief editions`);
  console.log(`[validate-data] OK: ${peopleTabs.size} people tabs, ${eventKeys.size} selected events`);
  console.log(`[validate-data] OK: ${tickerTabs.size} ticker tabs, ${tickerKeys.size} selected events`);
  console.log(`[validate-data] OK: ${cryptoTabs.size} crypto tabs, ${cryptoKeys.size} selected events`);
  console.log(`[validate-data] OK: ${aiTabs.size} ai tabs, ${aiKeys.size} selected events`);
  console.log(`[validate-data] OK: ${personCards} cards use original person names with registry intros`);
  console.log('[validate-data] OK: project research knowledge and Grok SOP');
  console.log(`[validate-data] OK: earnings calendar ${earnings.weeks?.length||0} weeks, ${earnings.counts?.important||0} important / ${earnings.counts?.raw||0} raw`);
}
