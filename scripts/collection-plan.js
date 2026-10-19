#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const progress = require('./lib/collection-progress');

const ROOT = path.resolve(__dirname, '..');

function loadConfig(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'config/collection-batches.json'), 'utf8'));
}

function normalizeCutoff(value) {
  if (!value) throw new Error('必须传入北京时间截止时间，例如 2026-10-18T20:30:00+08:00');
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
    if (batch.schedule === '20:30-only' && normalized.slot !== '20:30') action = 'skip';
    if (batch.schedule === 'daily-final' && normalized.slot !== (weekend?'08:00':'20:30')) action = 'skip';
    if (batch.schedule === 'learning-slots' && !['08:00', weekend?'08:00':'20:30'].includes(normalized.slot)) action = 'skip';
    if (batch.schedule === 'due-or-stale') action = 'check-due';
    if (!scheduled) action = 'skip';
    return {
      sequence: index + 1,
      ...batch,
      action,
      ...(batch.id==='learning'?{components:{papers:action==='run'&&normalized.slot==='08:00',basics:action==='run'&&normalized.slot===(weekend?'08:00':'20:30'),counterintuitive:action==='run'&&normalized.slot===(weekend?'08:00':'20:30')}}:{}),
      isolated: true,
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
    skipReason: scheduled ? null : '北京时间周末只在08:00整理一次；本时点不采集、不发布新期次。',
    sourcePriority: config.sourcePriority,
    rule: '每个对象从上次成功查询截止严格增量；手动与定时共用进度。展示保留与搜索窗口独立。无候选不空跑追源/反证；失败仅补查失败对象。',
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
