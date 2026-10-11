const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const RAW_PATH = path.join(ROOT, "data", "raw", "x-posts.json");
const SOURCES_PATH = path.join(ROOT, "sources", "x-sources.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function canonicalPostUrl(username, id) {
  return `https://x.com/${username}/status/${id}`;
}

function postIdFromUrl(value) {
  const match = String(value || "").match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  return match ? match[1] : null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceIndex(config = readJson(SOURCES_PATH)) {
  return new Map(
    (config.accounts || []).map((source) => [source.username.toLowerCase(), source])
  );
}

function mergePosts(existing, incoming) {
  const byId = new Map((existing || []).map((post) => [String(post.id), post]));
  for (const post of incoming || []) {
    const id = String(post.id);
    const previous = byId.get(id) || {};
    byId.set(id, {
      ...previous,
      ...post,
      firstCapturedAt: previous.firstCapturedAt || post.firstCapturedAt || post.capturedAt,
      capturedAt: post.capturedAt || previous.capturedAt
    });
  }
  return Array.from(byId.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function loadRaw() {
  if (!fs.existsSync(RAW_PATH)) return { schemaVersion: 1, updatedAt: null, posts: [] };
  return readJson(RAW_PATH);
}

function saveRaw(posts) {
  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    posts
  };
  writeJson(RAW_PATH, payload);
  return payload;
}

module.exports = {
  ROOT,
  RAW_PATH,
  SOURCES_PATH,
  readJson,
  writeJson,
  canonicalPostUrl,
  postIdFromUrl,
  sha256,
  sourceIndex,
  mergePosts,
  loadRaw,
  saveRaw
};
