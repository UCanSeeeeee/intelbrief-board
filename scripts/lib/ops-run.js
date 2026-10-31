// Durable ops-run logs for scheduled/manual content runs.
// Never store tokens, webhook keys, PATs, or other secrets.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCHEMA_VERSION = 1;
const STAGES = ['pull', 'read', 'search', 'write', 'validate', 'push', 'verify'];
const STAGE_STATUS = ['pending', 'ok', 'failed', 'skipped'];
const RUN_STATUS = ['running', 'success', 'partial', 'failed'];
const PAGE_IDS = ['news', 'people', 'tickers', 'ai', 'earnings', 'macro'];
const PAGE_STATUS = ['pending', 'ok', 'partial', 'failed', 'skipped', 'unchanged'];
const TRIGGERS = ['scheduled', 'manual', 'catchup'];

const SECRET_RE = /(?:bearer\s+[a-z0-9._\-+=\/]+|ghp_[a-zA-Z0-9]{20,}|gho_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|cf-[a-zA-Z0-9_\-]{16,}|sk-[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9\-]{10,}|webhook[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+|token\s*[:=]\s*\S+)/gi;

function scrub(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return String(value).replace(SECRET_RE, '[redacted]');
  return value.replace(SECRET_RE, '[redacted]');
}

function scrubStack(stack, max = 1200) {
  if (!stack) return null;
  const text = scrub(String(stack)).split('\n').slice(0, 12).join('\n');
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function beijingNow(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
}

function shanghaiIso(date = new Date()) {
  const p = beijingNow(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
}

// Current scheduled suffixes: 0800/2000. Older suffixes remain readable for historical ops-runs.
function assertPeriod(period) {
  if (!/^\d{4}-\d{2}-\d{2}-(?:0800|2000|1500|2030|0900|1600|2100)$/.test(period) && !/^manual-[a-f0-9-]{8,}$/.test(period) && !/^catchup-\d{4}-\d{2}-\d{2}-\d{4}$/.test(period)) {
    throw new Error('period 无效：定时用 YYYY-MM-DD-0800|2000（历史日志保留旧时段）；手动用 manual-<id>；补跑可用 catchup-YYYY-MM-DD-HHMM');
  }
}

function dir(root) {
  return path.join(root, 'data', 'ops-runs');
}

function runPath(root, period) {
  return path.join(dir(root), `${period}.json`);
}

function latestPath(root) {
  return path.join(dir(root), 'latest.json');
}

function gitHead(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function emptyPages() {
  return Object.fromEntries(PAGE_IDS.map(id => [id, { status: 'pending', detail: null }]));
}

function emptyStages() {
  return STAGES.map(name => ({ name, status: 'pending', at: null, detail: null }));
}

function createRun({ period, trigger = 'scheduled', gitHeadAtStart = null, notes = [] } = {}) {
  assertPeriod(period);
  if (!TRIGGERS.includes(trigger)) throw new Error('trigger 无效：scheduled|manual|catchup');
  const startedAt = shanghaiIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    period,
    trigger,
    timezone: 'Asia/Shanghai',
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    gitHeadAtStart: gitHeadAtStart || null,
    stages: emptyStages(),
    pages: emptyPages(),
    status: 'running',
    error: null,
    commitHash: null,
    notes: (notes || []).map(scrub)
  };
}

function readRun(root, period) {
  const file = runPath(root, period);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeRun(root, run) {
  assertPeriod(run.period);
  if (!RUN_STATUS.includes(run.status)) throw new Error('status 无效');
  run.updatedAt = shanghaiIso();
  fs.mkdirSync(dir(root), { recursive: true });
  const file = runPath(root, run.period);
  fs.writeFileSync(file, JSON.stringify(run, null, 2) + '\n', 'utf8');
  const latest = {
    schemaVersion: SCHEMA_VERSION,
    period: run.period,
    status: run.status,
    trigger: run.trigger,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    commitHash: run.commitHash,
    errorStage: run.error?.stage || null,
    errorMessage: run.error?.message || null,
    file: path.relative(root, file)
  };
  fs.writeFileSync(latestPath(root), JSON.stringify(latest, null, 2) + '\n', 'utf8');
  return file;
}

function start(root, { period, trigger = 'scheduled', notes = [], force = false } = {}) {
  assertPeriod(period);
  const existing = readRun(root, period);
  if (existing && !force) {
    if (existing.status === 'success' || existing.status === 'partial') {
      throw new Error(`期次 ${period} 已有终态日志（${existing.status}），禁止覆盖；查 data/ops-runs/${period}.json`);
    }
    // Resume a running/failed attempt: keep file, append note, return it.
    existing.notes = [...(existing.notes || []), scrub(`resume ${shanghaiIso()}`), ...notes.map(scrub)];
    existing.status = 'running';
    existing.error = null;
    return writeRun(root, existing);
  }
  const run = createRun({
    period,
    trigger,
    gitHeadAtStart: gitHead(root),
    notes
  });
  return writeRun(root, run);
}

function requireRun(root, period) {
  const run = readRun(root, period);
  if (!run) throw new Error(`找不到 ops-run：${period}；先 npm run ops:run -- start --period ${period}`);
  return run;
}

function setStage(root, { period, name, status, detail = null } = {}) {
  if (!STAGES.includes(name)) throw new Error(`stage 无效：${STAGES.join('|')}`);
  if (!STAGE_STATUS.includes(status)) throw new Error(`stage status 无效：${STAGE_STATUS.join('|')}`);
  const run = requireRun(root, period);
  const stage = run.stages.find(s => s.name === name);
  stage.status = status;
  stage.at = shanghaiIso();
  stage.detail = detail == null ? null : scrub(detail);
  if (status === 'failed') {
    run.status = 'failed';
    run.error = {
      stage: name,
      message: scrub(detail || `stage ${name} failed`),
      stackSnippet: null
    };
  }
  return writeRun(root, run);
}

// Fine-grained elapsed wall time; never infer model/tool time from these spans.
function setStep(root,{period,page,name,status,detail=null}={}){
  if(!['news','people','tickers','ai','learning','macro','earnings'].includes(page)||!['batch','discovery','source-verification','counter-evidence'].includes(name)||!['running','ok','failed','skipped'].includes(status))throw new Error('采集计时参数无效');
  const run=requireRun(root,period),now=shanghaiIso();
  run.timings=run.timings||[];
  let step=[...run.timings].reverse().find(s=>s.page===page&&s.name===name&&s.status==='running');
  if(status==='running'){
    if(step)throw new Error('该步骤已开始，不能重复重置计时');
    run.timings.push({page,name,status,startedAt:now,endedAt:null,durationMs:null,detail:scrub(detail)});
  }else{
    if(!step&&status!=='skipped')throw new Error('没有步骤起点，不能伪造耗时');
    if(!step){step={page,name,startedAt:null};run.timings.push(step);}
    Object.assign(step,{status,endedAt:now,durationMs:step.startedAt?Date.parse(now)-Date.parse(step.startedAt):0,detail:scrub(detail)});
  }
  return writeRun(root,run);
}

function setPage(root, { period, page, status, detail = null } = {}) {
  if (!PAGE_IDS.includes(page)) throw new Error(`page 无效：${PAGE_IDS.join('|')}`);
  if (!PAGE_STATUS.includes(status)) throw new Error(`page status 无效：${PAGE_STATUS.join('|')}`);
  const run = requireRun(root, period);
  run.pages[page] = { status, detail: detail == null ? null : scrub(detail) };
  return writeRun(root, run);
}

function fail(root, { period, stage = null, message, stack = null } = {}) {
  const run = requireRun(root, period);
  run.status = 'failed';
  run.finishedAt = shanghaiIso();
  run.error = {
    stage: stage && STAGES.includes(stage) ? stage : (stage || null),
    message: scrub(message || 'unknown failure'),
    stackSnippet: scrubStack(stack)
  };
  if (stage && STAGES.includes(stage)) {
    const item = run.stages.find(s => s.name === stage);
    item.status = 'failed';
    item.at = run.finishedAt;
    item.detail = run.error.message;
  }
  return writeRun(root, run);
}

function finish(root, { period, status, commitHash = null, note = null } = {}) {
  if (!['success', 'partial', 'failed'].includes(status)) throw new Error('finish status 须为 success|partial|failed');
  const run = requireRun(root, period);
  run.status = status;
  run.finishedAt = shanghaiIso();
  if (commitHash) run.commitHash = scrub(commitHash);
  if (note) run.notes = [...(run.notes || []), scrub(note)];
  if (status !== 'failed') run.error = null;
  return writeRun(root, run);
}

function summarize(run) {
  if (!run) return null;
  const pages = Object.entries(run.pages || {})
    .filter(([, v]) => v.status !== 'pending')
    .map(([k, v]) => `${k}:${v.status}`)
    .join(',');
  const failedStage = (run.stages || []).find(s => s.status === 'failed');
  return {
    period: run.period,
    status: run.status,
    trigger: run.trigger,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    commitHash: run.commitHash,
    pages,
    failedStage: failedStage?.name || run.error?.stage || null,
    errorMessage: run.error?.message || null
  };
}

module.exports = {
  SCHEMA_VERSION,
  STAGES,
  STAGE_STATUS,
  RUN_STATUS,
  PAGE_IDS,
  PAGE_STATUS,
  TRIGGERS,
  scrub,
  scrubStack,
  shanghaiIso,
  assertPeriod,
  dir,
  runPath,
  latestPath,
  gitHead,
  createRun,
  readRun,
  writeRun,
  start,
  setStage,
  setStep,
  setPage,
  fail,
  finish,
  summarize
};
