#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  canonicalPostUrl,
  loadRaw,
  mergePosts,
  postIdFromUrl,
  readJson,
  saveRaw,
  sha256,
  sourceIndex
} = require("./lib/x-data");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run import:x -- path/to/x-export.json");
  process.exit(2);
}

function requireDate(value, label) {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp`);
  return new Date(value).toISOString();
}

function normalize(item, index, sources, capturedAt) {
  const url = item.url || item.postUrl || item.link;
  const id = String(item.id || postIdFromUrl(url) || "");
  if (!/^\d+$/.test(id)) throw new Error(`posts[${index}] needs a numeric X status id or canonical post URL`);

  const username = item.author?.username || item.username || item.handle;
  if (!username) throw new Error(`posts[${index}] needs author.username`);
  const cleanUsername = String(username).replace(/^@/, "");
  const text = String(item.text || item.originalText || "").trim();
  if (!text) throw new Error(`posts[${index}] needs original post text`);
  const source = sources.get(cleanUsername.toLowerCase()) || {};
  const createdAt = requireDate(item.createdAt || item.created_at, `posts[${index}].createdAt`);

  return {
    id,
    url: canonicalPostUrl(cleanUsername, id),
    author: {
      id: String(item.author?.id || item.authorId || ""),
      username: cleanUsername,
      name: item.author?.name || item.authorName || source.displayName || cleanUsername,
      verified: Boolean(item.author?.verified),
      verifiedType: item.author?.verifiedType || null,
      followersCount: item.author?.followersCount ?? null
    },
    createdAt,
    capturedAt,
    firstCapturedAt: capturedAt,
    text,
    lang: item.lang || null,
    conversationId: item.conversationId || null,
    referencedPosts: item.referencedPosts || [],
    entities: item.entities || { urls: [], hashtags: [], cashtags: [], mentions: [] },
    media: item.media || [],
    metrics: item.metrics || {},
    category: item.category || source.category || "uncategorized",
    topics: item.topics || source.topics || [],
    accessStatus: item.accessStatus || "available",
    captureMethod: item.captureMethod || "grok-bot-export",
    captureSource: item.captureSource || path.basename(inputPath),
    assessment: item.assessment || undefined,
    contentHash: sha256(`${id}\n${text}`)
  };
}

function main() {
  const absolute = path.resolve(inputPath);
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const items = Array.isArray(parsed) ? parsed : parsed.posts;
  if (!Array.isArray(items)) throw new Error("Input must be an array or an object with posts[]");

  const capturedAt = new Date().toISOString();
  const sources = sourceIndex();
  const incoming = items.map((item, index) => normalize(item, index, sources, capturedAt));
  const raw = loadRaw();
  const merged = mergePosts(raw.posts, incoming);
  saveRaw(merged);
  console.log(`[import-x] imported ${incoming.length} posts from ${absolute}; archive now has ${merged.length}`);
}

try {
  main();
} catch (error) {
  console.error(`[import-x] ${error.message}`);
  process.exit(1);
}
