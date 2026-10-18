const fs = require('node:fs');
const { annotateCard } = require('./person-names');
const path = require('node:path');
const { ROOT, readJson } = require('./x-data');
const { scorePost } = require('./credibility');
const config = readJson(path.join(ROOT, 'config/stock-brief.json'));
const CARD_IDS = /^(M(?:0[1-9]|10)|I(?:0[1-9]|10)|R0[1-8])$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value, label) {
  requireValue(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `${label}: 需要带时区的时间`);
  return Date.parse(value);
}
function beijingDay(now) {
  return new Date(new Date(now).getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
function slotAt(now = new Date()) {
  const day = beijingDay(now);
  const times = [-1, 0, 1].flatMap(offset => {
    const date = new Date(Date.parse(day + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
    const weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
    return (weekend?(config.weekendSlots||['08:00']):config.slots).map(slot => ({ id: `${date}-${slot.replace(':', '')}`, scheduledFor: `${date}T${slot}:00+08:00` }));
  }).sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
  return {
    previous: times.filter(t => Date.parse(t.scheduledFor) <= new Date(now).getTime()).at(-1),
    next: times.find(t => Date.parse(t.scheduledFor) > new Date(now).getTime())
  };
}

function prepareBrief(input, { now = new Date(), sources = new Map() } = {}) {
  requireValue(input && typeof input === 'object', '需要简报对象');
  const brief = structuredClone(input);
  brief.trigger = brief.trigger || 'scheduled';
  requireValue(['manual','scheduled'].includes(brief.trigger), '期次类型无效');
  // Current slots 08:00/15:00/20:30; legacy 09:00/16:00/21:00 kept so historical archives still validate.
  if (brief.trigger === 'scheduled') requireValue(/^\d{4}-\d{2}-\d{2}T(?:08:00:00|15:00:00|20:30:00|09:00:00|16:00:00|21:00:00)\+08:00$/.test(brief.scheduledFor), '期次只能是北京时间 08:00、15:00、20:30（历史归档可含 09:00、16:00、21:00）');
  else requireValue(/^[a-f0-9-]{36}$/.test(brief.requestId), '手动期次需要任务编号');
  const cutoff = timestamp(brief.scheduledFor, 'scheduledFor');
  requireValue(cutoff <= new Date(now).getTime(), '不能提前发布未来期次');
  brief.id = brief.trigger === 'manual' ? `manual-${brief.requestId}` : brief.scheduledFor.slice(0, 10) + '-' + brief.scheduledFor.slice(11, 16).replace(':', '');
  brief.timezone = config.timezone;
  // v2 = separated display/search windows, pre-search checklist and candidate mapping are mandatory.
  const v2 = brief.displayWindowStart !== undefined;
  brief.schemaVersion = v2 ? 2 : 1;
  brief.generatedAt = new Date(now).toISOString();
  requireValue(['complete', 'partial', 'failed'].includes(brief.status), '无效简报状态');
  requireValue(nonempty(brief.summary), '需要本期市场概览');
  requireValue(nonempty(brief.marketContext), '需要交易时段/休市说明');
  const start = timestamp(brief.windowStart, 'windowStart');
  requireValue(start < cutoff, '检索窗口必须早于信息截止');
  const incremental=brief.collectionMode==='incremental-v1';
  if(incremental)requireValue(Array.isArray(brief.collectionUnits)&&brief.collectionUnits.length>0,'增量简报缺少对象窗口');
  requireValue(nonempty(brief.coverage?.method) && Array.isArray(brief.coverage?.queries) && Array.isArray(brief.coverage?.gaps), '需要采集方式、查询范围及覆盖缺口');
  requireValue(brief.coverage.queries.every(nonempty) && brief.coverage.gaps.every(nonempty), '查询与缺口必须为文字');
  if (brief.status !== 'failed') requireValue(brief.coverage.queries.length > 0, '有结果的期次需要保留实际查询');
  if (v2) {
    const ds = timestamp(brief.displayWindowStart, 'displayWindowStart');
    requireValue(timestamp(brief.displayWindowEnd, 'displayWindowEnd') === cutoff, '展示窗口必须结束于信息截止');
    requireValue(ds <= cutoff - 86400000, '展示窗口必须覆盖截止前完整 24 小时');
    requireValue(Array.isArray(brief.checklist) && (brief.status === 'failed' || brief.checklist.length > 0), '需要检索前清单');
    requireValue(brief.checklist.every(c => nonempty(c.item) && ['covered','no-result','insufficient'].includes(c.status)), '清单每项需要内容与状态（covered/no-result/insufficient）');
    requireValue(brief.checklist.filter(c => c.status !== 'covered').every(c => nonempty(c.note)), '未覆盖的清单项需要说明');
    requireValue(Array.isArray(brief.candidates ?? (brief.status === 'failed' ? [] : null)) && (brief.candidates || []).every(c => nonempty(c.eventKey) && [1,2].includes(c.round) && ['selected','excluded'].includes(c.decision) && nonempty(c.reason)), '需要两轮候选到入选的映射与理由');
    requireValue(Array.isArray(brief.carriedOver) && brief.carriedOver.every(c => nonempty(c.fromEdition) && nonempty(c.eventKey) && nonempty(c.title) && ['focus','insights'].includes(c.group) && timestamp(c.publishedAt, 'carriedOver.publishedAt') >= ds && Date.parse(c.publishedAt) < start), '展示窗口沿用条目必须来自更早期次且位于展示窗口内');
  }
  requireValue(nonempty(brief.selectionRationale), '需要两组事件的比较与排序依据');
  requireValue(Array.isArray(brief.excludedCandidates), '需要保留主要落选候选及理由');
  requireValue(brief.excludedCandidates.every(c => nonempty(c.eventKey) && nonempty(c.reason)), '落选候选缺少事件或理由');
  const eventKeys = new Set();
  const evidenceIds = new Set();
  const titles = new Set();
  for (const group of ['focus', 'insights']) {
    requireValue(Array.isArray(brief[group]) && brief[group].length <= config.targetCounts[group], `${group} 超出条数或缺少数组`);
    for (const event of brief[group]) {
      for (const key of ['eventKey', 'title', 'fact', 'impact', 'direction', 'horizon', 'counterCase', 'selectionReason', 'change', 'credibilityReason']) {
        requireValue(nonempty(event[key]), `事件缺少 ${key}`);
      }
      requireValue(!/(?:Grok\s*返回|Grok\s*称|采集器(?:返回|称)|原帖(?:汇总)?称)/i.test(event.fact), '信息摘要不能包含采集过程话术');
      try { annotateCard(event, undefined, `${group}.${event.eventKey}`); } catch (error) { requireValue(false, error.message); }
      requireValue(['利多', '利空', '双向', '待定'].includes(event.direction), '影响方向无效');
      requireValue(['新增', '进展', '延续'].includes(event.change), '事件变化标记无效');
      if (event.change === '延续') requireValue(nonempty(event.continuationReason), '延续事件需要说明当前仍有影响的原因');
      const normalizedKey = event.eventKey.trim().toLowerCase();
      const unit=incremental?brief.collectionUnits.find(u=>u.id===event.collectionUnit):null;
      if(incremental)requireValue(unit&&unit.page==='news'&&unit.needsQuery,'增量事件须关联真实采集对象');
      const normalizedTitle = event.title.replace(/\s/g, '').toLowerCase();
      requireValue(!eventKeys.has(normalizedKey) && !titles.has(normalizedTitle), '两组事件不可重复');
      eventKeys.add(normalizedKey); titles.add(normalizedTitle);
      if (event.eventTime !== null) requireValue(timestamp(event.eventTime, 'eventTime') <= cutoff || nonempty(event.futureEventNote), '未来事件需要预告说明');
      else {
        requireValue(nonempty(event.eventTimeNote), '实际事件时间未知时需注明');
        requireValue(!/(?:Grok|采集器)(?:\s*返回|\s*未提供|\s*称)/i.test(event.eventTimeNote), '事件时间说明不能包含采集过程话术');
      }
      requireValue(Array.isArray(event.affected) && event.affected.length && event.affected.every(nonempty), '需要受影响指数、行业或公司');
      requireValue(Array.isArray(event.sources) && event.sources.length, '每条事件需要 X 原帖证据');
      const scores = [];
      for (const source of event.sources) {
        const match = /^https:\/\/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,15})\/status\/(\d+)$/.exec(source.url || '');
        requireValue(match && typeof source.postId === 'string' && match[2] === source.postId && match[1].toLowerCase() === String(source.username).toLowerCase(), 'X 链接、帖子 ID 和作者必须一致');
        requireValue(!evidenceIds.has(source.postId), '同一原帖不能拆成多个名额');
        evidenceIds.add(source.postId);
        const posted = timestamp(source.publishedAt, 'publishedAt');
        requireValue(posted <= cutoff, '截止时间之后的帖子不能写入本期');
        if(incremental&&event.change!=='延续'&&!event.contextSourceNote)requireValue(posted>=Date.parse(unit.start)&&posted<Date.parse(unit.end),'新增原帖不属于该对象严格增量区间');
        requireValue(timestamp(source.checkedAt, 'checkedAt') <= new Date(now).getTime(), '核验时间不可在未来');
        requireValue(Date.parse(source.checkedAt) >= posted, '核验时间不可早于帖子');
        requireValue(nonempty(source.excerpt), '需要与事实相关的原文短摘录');
        requireValue(['direct', 'collector-report'].includes(source.verification), '需要标明原帖直读或采集器转述');
        requireValue(nonempty(source.verificationNote), '需要核验方式与缺口');
        if (posted < start) requireValue(event.change === '延续' || nonempty(event.contextSourceNote), '旧帖只能作为明确注明的背景或延续证据');
        const result = scorePost({ id: source.postId, url: source.url, text: source.excerpt, createdAt: source.publishedAt }, sources.get(source.username.toLowerCase()) || {});
        // A collector saying it read a post is not direct verification.
        if (source.verification === 'collector-report') {
          result.overall = Math.min(result.overall, 49);
          result.band = result.overall < 30 ? 'very-low' : 'low';
          result.meaning = '采集器返回，原帖未独立直读；仅作待核验线索';
          result.warnings.push('原帖尚未独立读取；当前证据为采集器返回');
        }
        source.credibility = result;
        scores.push(result.overall);
      }
      if (event.change !== '延续') requireValue(event.sources.some(s => Date.parse(s.publishedAt) >= start), '新增/进展事件至少需要一条窗口内原帖');
      if(incremental&&event.change!=='延续')requireValue(event.sources.some(s=>Date.parse(s.publishedAt)>=Date.parse(unit.start)&&Date.parse(s.publishedAt)<Date.parse(unit.end)),'新增/进展至少需要一条该对象增量内原帖，不能只用背景来源');
      event.credibility = {
        score: Math.min(...scores),
        label: '规则初评，未校准',
        reason: event.credibilityReason,
        limitation: '反映当前来源与证据条件，不是真实概率；事件排序另由影响判断决定。'
      };
      if (group === 'focus') requireValue(nonempty(event.attentionEvidence), '焦点事件需要市场关注的依据及其局限');
      if (group === 'insights') {
        requireValue(Array.isArray(event.knowledgeCards) && event.knowledgeCards.length && event.knowledgeCards.every(id => CARD_IDS.test(id)), '多学科事件需要有效知识卡编号');
        requireValue(nonempty(event.knowledgeApplication), '需要说明知识卡如何应用于当前事件');
        requireValue(Array.isArray(event.disciplines) && event.disciplines.length >= 2 && new Set(event.disciplines).size >= 2 && event.disciplines.every(nonempty), '需要至少两个学科及其传导连接');
      }
    }
  }
  const count = brief.focus.length + brief.insights.length;
  if (brief.status === 'complete') requireValue(brief.focus.length === 5 && brief.insights.length === 10, '完整期次必须为 5+10');
  // A completed search can legitimately yield zero qualifying events. It is not
  // a collection failure; actual queries and the shortfall explanation remain required.
  if (brief.status === 'partial') requireValue(count < 15 && nonempty(brief.shortfallReason), '不完整期次需要实际检索记录与缺额原因');
  if (brief.status === 'failed') requireValue(count === 0 && nonempty(brief.shortfallReason), '失败期次不能冒充有结果');
  brief.counts = { focus: brief.focus.length, insights: brief.insights.length, total: count };
  return brief;
}

function saveBrief(brief, root = ROOT) {
  requireValue(/^(?:\d{4}-\d{2}-\d{2}-(?:0800|1500|2030|0900|1600|2100)|manual-[a-f0-9-]{36})$/.test(brief.id), '无效归档 ID');
  const dir = path.join(root, 'data/stock-briefs');
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(dir, `${brief.id}.json`);
  const serialized = JSON.stringify(brief, null, 2) + '\n';
  if (fs.existsSync(archive)) {
    requireValue(fs.readFileSync(archive, 'utf8') === serialized, `期次 ${brief.id} 已冻结，禁止覆盖历史`);
  }
  const indexFile = path.join(dir, 'index.json');
  const index = fs.existsSync(indexFile) ? readJson(indexFile) : { schemaVersion: 1, editions: [] };
  const reading=require('./reading-board');
  let board=reading.readBoard(root);
  // Bootstrap only from real archives; retain full cards before the three-edition purge.
  if(!board.asOf) for(const old of [...index.editions].sort((a,b)=>Date.parse(a.scheduledFor)-Date.parse(b.scheduledFor))) {
    if(!/^(?:\d{4}-\d{2}-\d{2}-(?:0800|1500|2030|0900|1600|2100)|manual-[a-f0-9-]{36})\.json$/.test(old.file))throw new Error('无效历史路径');
    board=reading.advance(board,readJson(path.join(dir,old.file)));
  }
  board=reading.advance(board,brief); // reject invalid lifecycle changes before writing the immutable archive
  const windows=require('./windows');
  const complete=brief.status!=='failed'&&brief.coverage.status==='complete'&&brief.coverage.queries.length>0&&brief.coverage.gaps.length===0&&brief.checklist?.length>0&&brief.checklist.every(c=>['covered','no-result'].includes(c.status));
  const coverage=windows.recordCoverage(windows.readCoverage(root),{jobId:brief.id,page:'news',trigger:brief.trigger||'scheduled',start:brief.windowStart,end:brief.scheduledFor,status:brief.status==='failed'?'failed':complete?'complete':'partial',queries:brief.coverage.queries,recordedAt:brief.generatedAt},14,Date.parse(brief.generatedAt));
  if(!fs.existsSync(archive))fs.writeFileSync(archive, serialized, { flag: 'wx' });
  reading.writeBoard(root,board);
  const coverageFile=windows.coveragePath(root);
  fs.writeFileSync(coverageFile+'.tmp',JSON.stringify(coverage,null,2)+'\n');fs.renameSync(coverageFile+'.tmp',coverageFile);
  const entry = { id: brief.id, trigger: brief.trigger || 'scheduled', scheduledFor: brief.scheduledFor, generatedAt: brief.generatedAt, status: brief.status, counts: brief.counts, file: `${brief.id}.json` };
  const sorted = [entry, ...index.editions.filter(e => e.id !== brief.id)].sort((a,b) => Date.parse(b.scheduledFor)-Date.parse(a.scheduledFor));
  // Manual tests never evict scheduled archives: each trigger has its own limit.
  const limit = trigger => (typeof config.historyLimit === 'object' ? config.historyLimit[trigger] : config.historyLimit) || 3;
  const kept = [], expiredList = [], seen = { scheduled: 0, manual: 0 };
  for (const e of sorted) { const t = e.trigger || 'scheduled'; (seen[t]++ < limit(t) ? kept : expiredList).push(e); }
  index.editions = kept;
  for (const expired of expiredList) {
    const expiredFile = path.join(dir, expired.file);
    if (fs.existsSync(expiredFile)) fs.rmSync(expiredFile);
  }
  const temporary = `${indexFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(index, null, 2) + '\n');
  fs.renameSync(temporary, indexFile);
  return archive;
}

/** True when now is at or past the batch cutoff — publish immediately; never idle-wait. */
function isPublishDue(scheduledFor, now = new Date()) {
  const t = Date.parse(scheduledFor);
  requireValue(Number.isFinite(t), '无效 scheduledFor');
  return t <= new Date(now).getTime();
}
module.exports = { config, beijingDay, slotAt, prepareBrief, saveBrief, isPublishDue };
