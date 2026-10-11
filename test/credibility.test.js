const test = require("node:test");
const assert = require("node:assert/strict");
const { scorePost, specificityScore } = require("../scripts/lib/credibility");

function basePost(overrides = {}) {
  return {
    id: "2107909792945832070",
    url: "https://x.com/OpenAI/status/2107909792945832070",
    author: { username: "OpenAI" },
    createdAt: "2026-10-07T19:03:52.000Z",
    text: "We are launching a new product on 2026-10-08 for $MSFT developers.",
    referencedPosts: [],
    entities: { urls: [] },
    media: [],
    accessStatus: "available",
    assessment: { independentSupportPostIds: [], contradictionPostIds: [] },
    ...overrides
  };
}

test("official primary source scores above an unknown rumor", () => {
  const official = scorePost(basePost(), { trustTier: "primary" });
  const rumor = scorePost(
    basePost({
      author: { username: "unknown123" },
      text: "Rumor: sources say this may happen, unconfirmed."
    }),
    { trustTier: "unknown" }
  );
  assert.ok(official.overall > rumor.overall);
  assert.equal(official.status, "auto-provisional");
  assert.ok(rumor.warnings.some((item) => item.includes("传闻")));
});

test("independent support raises claim score", () => {
  const withoutSupport = scorePost(basePost(), { trustTier: "direct" });
  const withSupport = scorePost(
    basePost({ assessment: { independentSupportPostIds: ["1", "2"], contradictionPostIds: [] } }),
    { trustTier: "direct" }
  );
  assert.ok(withSupport.claimScore > withoutSupport.claimScore);
  assert.equal(withSupport.breakdown.independentCorroboration, 16);
});

test("engagement metrics do not change credibility", () => {
  const lowEngagement = scorePost(basePost({ metrics: { like_count: 1 } }), { trustTier: "primary" });
  const viral = scorePost(basePost({ metrics: { like_count: 1000000, retweet_count: 500000 } }), { trustTier: "primary" });
  assert.equal(lowEngagement.overall, viral.overall);
});

test("specificity is bounded", () => {
  assert.equal(specificityScore("nothing specific"), 0);
  assert.ok(specificityScore("$NVDA 2026-10-11 42% #AI") > 0);
  assert.ok(specificityScore("$A $B $C $D $E $F 1 2 3 4 5") <= 10);
});
