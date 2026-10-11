#!/usr/bin/env node
const path = require("path");
const { loadEnv } = require("./load-env");
const { scorePost } = require("./lib/credibility");
const { ROOT, loadRaw, readJson, sourceIndex, writeJson } = require("./lib/x-data");

loadEnv();

const outputPath = path.join(ROOT, "data", "x-intelligence.json");
const config = readJson(path.join(ROOT, "sources", "x-sources.json"));
const sources = sourceIndex(config);
const lookbackHours = Math.max(
  1,
  Number(process.env.X_LOOKBACK_HOURS || config.policy?.defaultLookbackHours || 168)
);

function validateAssessment(post, allById) {
  const assessment = post.assessment || {};
  const author = post.author?.username?.toLowerCase();
  const independentSupportPostIds = (assessment.independentSupportPostIds || [])
    .map(String)
    .filter((id) => {
      const candidate = allById.get(id);
      return candidate && candidate.author?.username?.toLowerCase() !== author;
    });
  const contradictionPostIds = (assessment.contradictionPostIds || [])
    .map(String)
    .filter((id) => allById.has(id));
  return { ...assessment, independentSupportPostIds, contradictionPostIds };
}

function main() {
  const raw = loadRaw();
  const allById = new Map((raw.posts || []).map((post) => [String(post.id), post]));
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
  const posts = (raw.posts || [])
    .filter((post) => Date.parse(post.createdAt) >= cutoff)
    .map((post) => {
      const source = sources.get(post.author?.username?.toLowerCase()) || {
        trustTier: "unknown",
        sourceClass: "unregistered"
      };
      const normalized = { ...post, assessment: validateAssessment(post, allById) };
      return {
        ...normalized,
        sourceProfile: {
          trustTier: source.trustTier || "unknown",
          sourceClass: source.sourceClass || "unregistered",
          maintained: sources.has(post.author?.username?.toLowerCase())
        },
        credibility: scorePost(normalized, source)
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const stats = { total: posts.length, high: 0, mediumHigh: 0, medium: 0, low: 0, veryLow: 0 };
  const statKeys = {
    high: "high",
    "medium-high": "mediumHigh",
    medium: "medium",
    low: "low",
    "very-low": "veryLow"
  };
  for (const post of posts) stats[statKeys[post.credibility.band]] += 1;

  writeJson(outputPath, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    source: "X only",
    scoringVersion: "1.0.0",
    lookbackHours,
    posts,
    stats
  });
  console.log(`[build-intelligence] wrote ${posts.length} scored posts to ${outputPath}`);
}

main();
