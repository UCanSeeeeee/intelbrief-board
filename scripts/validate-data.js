#!/usr/bin/env node
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
    if (!/^\d{4}-\d{2}-\d{2}-(?:0900|1600|2100)$/.test(entry.id) || entry.file !== `${entry.id}.json`) throw new Error('invalid archive path');
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

if (!process.exitCode) {
  console.log(`[validate-data] OK: ${ids.size} raw posts, ${(intelligence.posts || []).length} display posts`);
  console.log(`[validate-data] OK: ${editionIds.size} stock brief editions`);
}
