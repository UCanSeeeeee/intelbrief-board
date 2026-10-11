const RUMOR_PATTERNS = [
  /\brumou?r\b/i,
  /\breportedly\b/i,
  /\bsources? (?:say|said)\b/i,
  /\bunconfirmed\b/i,
  /传闻|据悉|消息人士|未经证实|未确认/
];

const SPECIFIC_PATTERNS = [
  /\$[A-Z]{1,6}\b/g,
  /\b\d+(?:\.\d+)?%?\b/g,
  /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g,
  /#[\p{L}\p{N}_]+/gu
];

const SOURCE_BASE = {
  primary: 92,
  direct: 82,
  established: 74,
  specialist: 64,
  monitored: 50,
  unknown: 35
};

const BAND_TEXT = {
  high: "高：原始身份与主张证据都较强，仍需区分事实与预测",
  "medium-high": "中高：来源较可靠，但证据或独立印证仍有缺口",
  medium: "中：可作为研究线索，不宜单独用于决策",
  low: "低：来源、证据或可核验性明显不足",
  "very-low": "很低：仅保留作线索，不应视为已证实信息"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBand(score) {
  if (score >= 85) return "high";
  if (score >= 70) return "medium-high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "very-low";
}

function specificityScore(text) {
  const matches = SPECIFIC_PATTERNS.flatMap((pattern) => text.match(pattern) || []);
  const unique = new Set(matches.map((value) => value.toLowerCase()));
  return clamp(unique.size * 2, 0, 10);
}

function scorePost(post, source = {}) {
  const reasons = [];
  const warnings = [];
  const trustTier = source.trustTier || "unknown";
  const sourceScore = SOURCE_BASE[trustTier] ?? SOURCE_BASE.unknown;

  if (trustTier === "primary") reasons.push("账号在人工来源表中登记为机构一手来源");
  else if (trustTier === "direct") reasons.push("账号在人工来源表中登记为具名当事人");
  else if (trustTier === "unknown") warnings.push("作者未进入人工维护的来源表");
  else reasons.push(`来源等级：${trustTier}`);

  let directness = 10;
  if (trustTier === "primary") directness = 30;
  else if (trustTier === "direct") directness = 25;
  else if (trustTier === "established") directness = 20;
  else if (trustTier === "specialist") directness = 16;

  if (post.referencedPosts?.some((item) => item.type === "quoted")) {
    directness = Math.max(8, directness - 4);
    warnings.push("该帖包含转述或引用，原作者身份不等于被引主张已获证实");
  }
  if (post.referencedPosts?.some((item) => item.type === "replied_to")) {
    directness = Math.max(8, directness - 2);
  }

  let evidence = 0;
  const urls = post.entities?.urls || [];
  const media = post.media || [];
  const references = post.referencedPosts || [];
  if (post.url && /^https:\/\/(?:x|twitter)\.com\//i.test(post.url)) evidence += 7;
  if (references.length) evidence += 7;
  if (urls.length) evidence += 6;
  if (media.length) evidence += 5;
  evidence = clamp(evidence, 0, 25);
  if (evidence >= 15) reasons.push("保留了可回到原帖或引用链的证据");
  else warnings.push("帖子所附可追溯证据有限");

  const supportIds = post.assessment?.independentSupportPostIds || [];
  const contradictionIds = post.assessment?.contradictionPostIds || [];
  const corroboration = clamp(supportIds.length * 8, 0, 25);
  if (supportIds.length) reasons.push(`记录了 ${supportIds.length} 条独立 X 帖支持`);
  else warnings.push("尚无人工确认的独立 X 帖交叉印证");
  if (contradictionIds.length) warnings.push(`存在 ${contradictionIds.length} 条相反证据`);

  const specificity = specificityScore(post.text || "");
  if (specificity >= 6) reasons.push("主张包含较具体、可核验的对象或数字");

  let integrity = 0;
  if (post.id && /^\d+$/.test(String(post.id))) integrity += 4;
  if (post.createdAt && !Number.isNaN(Date.parse(post.createdAt))) integrity += 3;
  if ((post.text || "").trim().length >= 20) integrity += 3;

  let penalty = clamp(contradictionIds.length * 12, 0, 24);
  if (RUMOR_PATTERNS.some((pattern) => pattern.test(post.text || ""))) {
    penalty += 10;
    warnings.push("文本含传闻或未确认措辞");
  }
  if (post.accessStatus && post.accessStatus !== "available") {
    penalty += 15;
    warnings.push(`原帖当前状态：${post.accessStatus}`);
  }
  if (post.captureMethod === "screenshot-only") {
    penalty += 15;
    warnings.push("只有截图，没有可核验的原帖链接");
  }
  penalty = clamp(penalty, 0, 35);

  const claimScore = clamp(directness + evidence + corroboration + specificity + integrity - penalty, 0, 100);
  const overall = Math.round(sourceScore * 0.4 + claimScore * 0.6);
  const band = getBand(overall);

  return {
    version: "1.0.0",
    status: "auto-provisional",
    overall,
    band,
    meaning: BAND_TEXT[band],
    sourceScore,
    claimScore,
    breakdown: {
      directness,
      traceableEvidence: evidence,
      independentCorroboration: corroboration,
      specificity,
      recordIntegrity: integrity,
      penalties: penalty
    },
    reasons,
    warnings,
    limitations: [
      "分数衡量可追溯性与当前证据强弱，不等同于真伪概率",
      "蓝标、点赞量和转发量不自动提高可信度",
      "只有人工复核过独立帖子后，交叉印证项才会加分"
    ]
  };
}

module.exports = { scorePost, getBand, specificityScore };
