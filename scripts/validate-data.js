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

const guidance = readJson(path.join(ROOT, 'config/research-guidance.json'));
if (JSON.stringify(guidance.priorityOrder) !== JSON.stringify(['半导体','电力','AI 落地'])) fail('research guidance priority order changed unexpectedly');
for (const key of ['knowledgeBase','collectionSop']) {
  const file = path.resolve(ROOT, guidance[key] || '');
  if (!file.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(file)) fail(`research guidance missing ${key}`);
  else if (fs.readFileSync(file,'utf8').length < 1000) fail(`research guidance ${key} is unexpectedly empty`);
}

if (!process.exitCode) {
  console.log(`[validate-data] OK: ${ids.size} raw posts, ${(intelligence.posts || []).length} display posts`);
  console.log(`[validate-data] OK: ${editionIds.size} stock brief editions`);
  console.log(`[validate-data] OK: ${peopleTabs.size} people tabs, ${eventKeys.size} selected events`);
  console.log('[validate-data] OK: project research knowledge and Grok SOP');
}
