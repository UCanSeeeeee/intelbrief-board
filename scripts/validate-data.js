#!/usr/bin/env node
const path = require("path");
const { ROOT, readJson, postIdFromUrl } = require("./lib/x-data");

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

if (!process.exitCode) {
  console.log(`[validate-data] OK: ${ids.size} raw posts, ${(intelligence.posts || []).length} display posts`);
}
