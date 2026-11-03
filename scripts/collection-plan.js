#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const progress = require('./lib/collection-progress');
const {hotspotPrompts} = require('./lib/ticker-hotspot-prompt');
const {beijingIso} = require('./lib/windows');

const ROOT = path.resolve(__dirname, '..');

function loadConfig(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'config/collection-batches.json'), 'utf8'));
}

function normalizeCutoff(value) {
  if (!value) throw new Error('必须传入北京时间截止时间，例如 2026-10-31T20:00:00+08:00');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('截止时间无法解析：' + value);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(String(value))) throw new Error('截止时间必须带时区');
  const iso=beijingIso(parsed.getTime());
  return {iso, slot:iso.slice(11,16)};
}

function createPlan(cutoff, config = loadConfig(), root = ROOT, scheduledFor = cutoff) {
  const actual=normalizeCutoff(cutoff), normalized = normalizeCutoff(scheduledFor);
  if (!config.slots.includes(normalized.slot)) throw new Error(`不支持的批次 ${normalized.slot}；允许：${config.slots.join('、')}`);
  if (Date.parse(actual.iso)<Date.parse(normalized.iso)) throw new Error('实际采集截止不能早于计划期次');
  const date=normalized.iso.slice(0,10), weekday=new Date(date+'T12:00:00Z').getUTCDay(), weekend=[0,6].includes(weekday);
  const weekendSlots=config.weekendSlotsByDay?.[String(weekday)]||config.weekendSlots||['08:00'];
  const scheduled = !weekend || weekendSlots.includes(normalized.slot);
  const collectionUnits = progress.plan(root,actual.iso);
  const batches = config.batches.map((batch, index) => {
    let action = 'run';
    if (batch.schedule === '20:00-only' && normalized.slot !== '20:00') action = 'skip';
    if (batch.schedule === 'daily-final' && normalized.slot !== '20:00') action = 'skip';
    if (batch.schedule === 'learning-slots' && !['08:00', '20:00'].includes(normalized.slot)) action = 'skip';
    if (batch.schedule === 'due-or-stale') action = 'check-due';
    if (!scheduled) action = 'skip';
    return {
      sequence: index + 1,
      ...batch,
      action,
      ...(batch.id==='learning'?{components:{papers:action==='run'&&(normalized.slot==='08:00'||weekday===0&&normalized.slot==='20:00'),basics:action==='run'&&(normalized.slot==='20:00'||weekday===6&&normalized.slot==='08:00'),counterintuitive:action==='run'&&(normalized.slot==='20:00'||weekday===6&&normalized.slot==='08:00')}}:{}),
      ...(batch.id==='learning'?{lessonInstruction:'basics到期时按docs/DAILY_LEARNING.md的原始提示词写1篇fable-reveal：一个研究生水平概念，寓言在前、概念解释在后，标题和开场不剧透，机制在结尾显现，保留类比边界和可核对来源；不新增名额、不改旧卡。'}:{}),
      ...(batch.id==='learning'?{sourceInstruction:'本机优先复用已核验证据，并直接查询本栏目获准的期刊、Crossref、PubMed和作者/机构合法公开版本及官方统计或教育来源，按各栏目契约核验；不必先调用Grok。只在本轮获准、额度可用且有实际来源缺口时才用Grok补充发现；不扩大X新闻来源。'}:{}),
      isolated: true,
      ...(batch.id==='tickers'?{
        hotspotInstruction:'热点与事实分开，每股用独立会话优先询问Grok Bot；主请求结束、明确失败或确认停止后才用Grok网页Expert定点补实际缺口，状态不明则保留断点，不并发重复查询。只发送hotspotPrompts的简短prompt。关键词只有股票代码，时间从该股上次成功截止接至本次实际截止，按浏览量前五；不加主题、账号、官方或广告等内容过滤。读取结果后本机再整理字段，不把知识库、事实门槛、JSON契约塞进检索请求。存在已知遗漏或字段错误时针对性核对，不静默接受明显缺口。',
        hotspotPrompts:hotspotPrompts(JSON.parse(fs.readFileSync(path.join(root,'config/ticker-intelligence.json'),'utf8')),actual.iso,collectionUnits)
      }:{}),
      collectionUnits: collectionUnits.filter(unit=>unit.page===batch.id),
      publicQueryWindows: collectionUnits.filter(unit=>unit.page===batch.id).map(({id,object,start,end,cutoff,needsQuery,catchingUp,kind})=>({id,object,start,end,cutoff,needsQuery,catchingUp,...(kind?{kind}:{})})),
      inputRule: '只读取本批次所需配置、旧数据与上游已验收证据，不把其他侧边栏候选混入本批次。',
      outputRule: '独立记录查询、候选、缺口和结果；完成后才交给总编排合并、全站校验与发布。'
    };
  });
  return {
    schemaVersion: 1,
    timezone: config.timezone,
    scheduledFor: normalized.iso,
    cutoff: actual.iso,
    slot: normalized.slot,
    scheduled,
    skipReason: scheduled ? null : '周六20:00和周日08:00不运行，不采集、不发布新期次。',
    sourcePriority: config.sourcePriority,
    budgetPolicy: {
      status: '运行前确认当前定时状态；仅在用户授权恢复或本次手动采集时执行，不自行恢复或补跑。',
      fallback: '相同侧栏、对象、窗口、阶段的Bot请求完成、明确失败或确认停止后，网页Expert才定点补实际缺口；状态不明保留断点，不并发重复查询，额度耗尽不循环重试。',
      context: '本机读取知识库及页面契约，只给外部采集器发送当前公开问题、必要机制、时间窗及证据要求；不发送整库、无关历史、进度pending或完整发布契约。公开查询窗口可用publicQueryWindows，完整collectionUnits仅供本机进度和审计。',
      reuse: '复用同一原始证据和既有核验；保留各侧栏独立发现、新闻两轮和六包及每股独立热点。允许相同原帖跨侧栏展示，不跨栏去重。',
      nonX: '论文、小知识、宏观和财报由本机按其已授权非X来源处理；X信息仍只走Grok Bot及Grok网页Expert。',
      quality: '不改变采集频次、信息范围、热点筛选、栏目数量或证据标准；查询失败保留存量和真实断点，不编造、不凑数。'
    },
    rule: '事实及每股独立热点均从各自上次成功截止严格接续至本次实际截止；手动与定时共用记录，失败保留存量；无新事实候选不空跑追源/反证。',
    batches
  };
}

function main(args = process.argv.slice(2)) {
  process.stdout.write(JSON.stringify(createPlan(args[0],loadConfig(),ROOT,args[1]||args[0]), null, 2) + '\n');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {loadConfig, normalizeCutoff, createPlan};
