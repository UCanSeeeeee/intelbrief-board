#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const progress = require('./lib/collection-progress');
const {hotspotPrompts} = require('./lib/ticker-hotspot-prompt');

const ROOT = path.resolve(__dirname, '..');

function loadConfig(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'config/collection-batches.json'), 'utf8'));
}

function normalizeCutoff(value) {
  if (!value) throw new Error('必须传入北京时间截止时间，例如 2026-10-31T20:00:00+08:00');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('截止时间无法解析：' + value);
  const match = String(value).match(/T(\d{2}):(\d{2})/);
  if (!match) throw new Error('截止时间必须包含小时和分钟');
  return {iso: value, slot: `${match[1]}:${match[2]}`};
}

function createPlan(cutoff, config = loadConfig(), root = ROOT) {
  const normalized = normalizeCutoff(cutoff);
  if (!config.slots.includes(normalized.slot)) throw new Error(`不支持的批次 ${normalized.slot}；允许：${config.slots.join('、')}`);
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(cutoff));
  const weekend = [0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
  const scheduled = !weekend || (config.weekendSlots||['08:00']).includes(normalized.slot);
  const collectionUnits = progress.plan(root,cutoff);
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
      ...(batch.id==='learning'?{components:{papers:action==='run'&&normalized.slot==='08:00',basics:action==='run'&&normalized.slot==='20:00',counterintuitive:action==='run'&&normalized.slot==='20:00'}}:{}),
      ...(batch.id==='learning'?{lessonInstruction:'basics到期时按docs/DAILY_LEARNING.md的原始提示词写1篇fable-reveal：一个研究生水平概念，寓言在前、概念解释在后，标题和开场不剧透，机制在结尾显现，保留类比边界和可核对来源；不新增名额、不改旧卡。'}:{}),
      isolated: true,
      ...(batch.id==='tickers'?{
        hotspotInstruction:'热点与事实分开，每股用独立会话优先询问Grok Bot；Bot不可用或结果有明确缺口时由Grok网页Expert补查，只发送hotspotPrompts的简短prompt。关键词只有股票代码，发帖时间必须在截止前24小时，按浏览量前五；不加主题、账号、官方或广告等内容过滤。读取结果后本机再整理字段，不把知识库、事实门槛、JSON契约塞进检索请求。存在已知遗漏或字段错误时针对性核对，不静默接受明显缺口。',
        hotspotPrompts:hotspotPrompts(JSON.parse(fs.readFileSync(path.join(root,'config/ticker-intelligence.json'),'utf8')),cutoff)
      }:{}),
      collectionUnits: collectionUnits.filter(unit=>unit.page===batch.id),
      inputRule: '只读取本批次所需配置、旧数据与上游已验收证据，不把其他侧边栏候选混入本批次。',
      outputRule: '独立记录查询、候选、缺口和结果；完成后才交给总编排合并、全站校验与发布。'
    };
  });
  return {
    schemaVersion: 1,
    timezone: config.timezone,
    cutoff: normalized.iso,
    slot: normalized.slot,
    scheduled,
    skipReason: scheduled ? null : '本时点不在北京时间的计划批次内，不采集、不发布新期次。',
    sourcePriority: config.sourcePriority,
    rule: '事实对象从上次成功截止严格增量；个股热点例外，每股独立查询完整24h浏览量榜。手动与定时共用记录，失败保留存量；无新事实候选不空跑追源/反证。',
    batches
  };
}

function main(args = process.argv.slice(2)) {
  process.stdout.write(JSON.stringify(createPlan(args[0]), null, 2) + '\n');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {loadConfig, normalizeCutoff, createPlan};
