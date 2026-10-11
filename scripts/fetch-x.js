#!/usr/bin/env node
// Historical implementation retained for traceability. User's 2026-10-11 source rule forbids this path.
console.error('X API采集已停用：必须先使用本机Grok Bot App，失败时才使用Grok网页版。见AGENTS.md。');
process.exit(2);
const { loadEnv } = require("./load-env");
const {
  SOURCES_PATH,
  canonicalPostUrl,
  loadRaw,
  mergePosts,
  readJson,
  saveRaw,
  sha256
} = require("./lib/x-data");

loadEnv();

const token = process.env.X_BEARER_TOKEN;
const maxResults = Math.max(5, Math.min(100, Number(process.env.X_MAX_RESULTS || 20)));
const lookbackHours = Math.max(1, Number(process.env.X_LOOKBACK_HOURS || 168));
const apiBase = "https://api.x.com/2";

if (!token) {
  console.error("[fetch-x] X_BEARER_TOKEN is required. Copy .env.example to .env and add the token.");
  process.exit(2);
}

async function api(pathname, params = {}) {
  const url = new URL(apiBase + pathname);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

function mapUsers(includes = {}) {
  return new Map((includes.users || []).map((user) => [String(user.id), user]));
}

function mapMedia(includes = {}) {
  return new Map((includes.media || []).map((item) => [item.media_key, item]));
}

function normalizeTweet(tweet, user, mediaByKey, source, capturedAt, referencedById = new Map(), usersById = new Map()) {
  const username = user?.username || source.username;
  const text = tweet.note_tweet?.text || tweet.text;
  const entities = tweet.note_tweet?.entities || tweet.entities || {};
  const media = (tweet.attachments?.media_keys || [])
    .map((key) => mediaByKey.get(key))
    .filter(Boolean)
    .map((item) => ({
      key: item.media_key,
      type: item.type,
      url: item.url || item.preview_image_url || null,
      width: item.width || null,
      height: item.height || null,
      altText: item.alt_text || null
    }));
  const referencedPosts = (tweet.referenced_tweets || []).map((item) => {
    const referenced = referencedById.get(String(item.id));
    const referencedAuthor = referenced ? usersById.get(String(referenced.author_id)) : null;
    return {
      id: String(item.id),
      type: item.type,
      url: referencedAuthor ? canonicalPostUrl(referencedAuthor.username, item.id) : null,
      author: referencedAuthor
        ? { id: String(referencedAuthor.id), username: referencedAuthor.username, name: referencedAuthor.name }
        : null,
      createdAt: referenced?.created_at || null,
      text: referenced?.note_tweet?.text || referenced?.text || null
    };
  });
  const urls = (entities.urls || []).map((item) => ({
    url: item.url,
    expandedUrl: item.expanded_url || null,
    displayUrl: item.display_url || null,
    title: item.title || null,
    description: item.description || null
  }));
  const normalized = {
    id: String(tweet.id),
    url: canonicalPostUrl(username, tweet.id),
    author: {
      id: String(user?.id || tweet.author_id || ""),
      username,
      name: user?.name || source.displayName || username,
      verified: Boolean(user?.verified),
      verifiedType: user?.verified_type || null,
      followersCount: user?.public_metrics?.followers_count ?? null
    },
    createdAt: tweet.created_at,
    capturedAt,
    firstCapturedAt: capturedAt,
    text,
    lang: tweet.lang || null,
    conversationId: tweet.conversation_id || null,
    referencedPosts,
    entities: {
      urls,
      hashtags: (entities.hashtags || []).map((item) => item.tag),
      cashtags: (entities.cashtags || []).map((item) => item.tag),
      mentions: (entities.mentions || []).map((item) => item.username)
    },
    media,
    metrics: tweet.public_metrics || {},
    category: source.category || "uncategorized",
    topics: source.topics || [],
    accessStatus: "available",
    captureMethod: "x-api-v2",
    captureSource: source.username ? `account:${source.username}` : `search:${source.id}`,
    contentHash: sha256(`${tweet.id}\n${text}`)
  };
  return normalized;
}

async function main() {
  const config = readJson(SOURCES_PATH);
  const accounts = (config.accounts || []).filter((item) => item.enabled);
  if (!accounts.length) throw new Error("No enabled X accounts in sources/x-sources.json");

  const usernames = accounts.map((item) => item.username).join(",");
  const userLookup = await api("/users/by", {
    usernames,
    "user.fields": "created_at,description,public_metrics,verified,verified_type"
  });
  const userByName = new Map((userLookup.data || []).map((user) => [user.username.toLowerCase(), user]));
  const missing = accounts.filter((item) => !userByName.has(item.username.toLowerCase()));
  for (const item of missing) console.warn(`[fetch-x] account not resolved: @${item.username}`);

  const capturedAt = new Date().toISOString();
  const startTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const recentSearchStartTime = new Date(
    Date.now() - Math.min(lookbackHours, 167) * 60 * 60 * 1000
  ).toISOString();
  const fetched = [];
  const failures = [];

  for (const source of accounts) {
    const user = userByName.get(source.username.toLowerCase());
    if (!user) continue;
    try {
      const payload = await api(`/users/${user.id}/tweets`, {
        max_results: maxResults,
        start_time: startTime,
        exclude: config.policy?.excludeRetweets ? "retweets" : undefined,
        "tweet.fields": "id,text,note_tweet,author_id,created_at,conversation_id,lang,public_metrics,entities,attachments,referenced_tweets",
        expansions: "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
        "user.fields": "name,username,public_metrics,verified,verified_type"
      });
      const users = mapUsers(payload.includes);
      users.set(String(user.id), user);
      const media = mapMedia(payload.includes);
      const references = new Map((payload.includes?.tweets || []).map((item) => [String(item.id), item]));
      for (const tweet of payload.data || []) {
        fetched.push(normalizeTweet(tweet, users.get(String(tweet.author_id)) || user, media, source, capturedAt, references, users));
      }
      console.log(`[fetch-x] @${source.username}: ${(payload.data || []).length}`);
    } catch (error) {
      failures.push({ source: `@${source.username}`, error: error.message });
      console.warn(`[fetch-x] @${source.username} failed: ${error.message}`);
    }
  }

  for (const search of (config.searches || []).filter((item) => item.enabled)) {
    try {
      const payload = await api("/tweets/search/recent", {
        query: search.query,
        max_results: Math.max(10, maxResults),
        start_time: recentSearchStartTime,
        "tweet.fields": "id,text,note_tweet,author_id,created_at,conversation_id,lang,public_metrics,entities,attachments,referenced_tweets",
        expansions: "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id",
        "media.fields": "media_key,type,url,preview_image_url,width,height,alt_text",
        "user.fields": "name,username,public_metrics,verified,verified_type"
      });
      const users = mapUsers(payload.includes);
      const media = mapMedia(payload.includes);
      const references = new Map((payload.includes?.tweets || []).map((item) => [String(item.id), item]));
      for (const tweet of payload.data || []) {
        const user = users.get(String(tweet.author_id));
        const source = {
          id: search.id,
          category: search.category,
          username: user?.username,
          displayName: user?.name,
          topics: []
        };
        fetched.push(normalizeTweet(tweet, user, media, source, capturedAt, references, users));
      }
      console.log(`[fetch-x] search:${search.id}: ${(payload.data || []).length}`);
    } catch (error) {
      failures.push({ source: `search:${search.id}`, error: error.message });
      console.warn(`[fetch-x] search:${search.id} failed: ${error.message}`);
    }
  }

  if (!fetched.length && failures.length) {
    throw new Error(`No posts fetched. First failure: ${failures[0].source} ${failures[0].error}`);
  }

  const raw = loadRaw();
  const merged = mergePosts(raw.posts, fetched);
  saveRaw(merged);
  console.log(`[fetch-x] saved ${fetched.length} fetched posts; archive now has ${merged.length}`);
  if (failures.length) console.warn(`[fetch-x] partial run with ${failures.length} failed source(s)`);
}

main().catch((error) => {
  console.error(`[fetch-x] ${error.message}`);
  process.exit(1);
});
