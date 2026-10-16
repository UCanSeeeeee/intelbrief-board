const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ops = require('../scripts/lib/ops-run');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ops-run-'));
}

test('start writes period file and latest pointer without secrets', () => {
  const root = tmp();
  try {
    const file = ops.start(root, {
      period: '2026-10-13-0900',
      trigger: 'scheduled',
      notes: ['token=ghp_ABCDEFGHIJKLMNOPQRSTUVWX and Bearer abc.def.ghi']
    });
    assert.equal(path.basename(file), '2026-10-13-0900.json');
    const run = ops.readRun(root, '2026-10-13-0900');
    assert.equal(run.schemaVersion, 1);
    assert.equal(run.status, 'running');
    assert.equal(run.trigger, 'scheduled');
    assert.equal(run.timezone, 'Asia/Shanghai');
    assert.match(run.startedAt, /\+08:00$/);
    assert.equal(run.stages.length, 7);
    assert.equal(run.pages.news.status, 'pending');
    assert.ok(run.notes[0].includes('[redacted]'));
    assert.equal(run.notes[0].includes('ghp_'), false);
    const latest = JSON.parse(fs.readFileSync(ops.latestPath(root), 'utf8'));
    assert.equal(latest.period, '2026-10-13-0900');
    assert.equal(latest.status, 'running');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stage page fail finish milestones are falsifiable', () => {
  const root = tmp();
  try {
    ops.start(root, { period: '2026-10-13-0900', trigger: 'catchup' });
    ops.setStage(root, { period: '2026-10-13-0900', name: 'pull', status: 'ok', detail: 'ff-only' });
    ops.setStage(root, { period: '2026-10-13-0900', name: 'search', status: 'ok' });
    ops.setPage(root, { period: '2026-10-13-0900', page: 'news', status: 'partial', detail: '3+4' });
    ops.setPage(root, { period: '2026-10-13-0900', page: 'people', status: 'ok' });
    ops.finish(root, { period: '2026-10-13-0900', status: 'partial', commitHash: 'abc123', note: 'online verified' });
    const run = ops.readRun(root, '2026-10-13-0900');
    assert.equal(run.stages.find(s => s.name === 'pull').status, 'ok');
    assert.equal(run.pages.news.status, 'partial');
    assert.equal(run.status, 'partial');
    assert.equal(run.commitHash, 'abc123');
    assert.ok(run.finishedAt);
    const summary = ops.summarize(run);
    assert.equal(summary.failedStage, null);
    assert.match(summary.pages, /news:partial/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('failed stage records error; success run cannot be overwritten without force', () => {
  const root = tmp();
  try {
    ops.start(root, { period: '2026-10-13-1600' });
    ops.fail(root, {
      period: '2026-10-13-1600',
      stage: 'validate',
      message: 'checklist incomplete',
      stack: 'Error: checklist incomplete\n    at prepare (/tmp/x.js:1:1)\nBearer secret-token-value'
    });
    let run = ops.readRun(root, '2026-10-13-1600');
    assert.equal(run.status, 'failed');
    assert.equal(run.error.stage, 'validate');
    assert.equal(run.stages.find(s => s.name === 'validate').status, 'failed');
    assert.ok(run.error.stackSnippet.includes('[redacted]'));
    assert.equal(run.error.stackSnippet.includes('secret-token-value'), false);

    // Resume failed → running allowed
    ops.start(root, { period: '2026-10-13-1600', notes: ['retry 1'] });
    run = ops.readRun(root, '2026-10-13-1600');
    assert.equal(run.status, 'running');
    ops.finish(root, { period: '2026-10-13-1600', status: 'success', commitHash: 'def' });
    assert.throws(
      () => ops.start(root, { period: '2026-10-13-1600' }),
      /终态/
    );
    ops.start(root, { period: '2026-10-13-1600', force: true, trigger: 'catchup' });
    assert.equal(ops.readRun(root, '2026-10-13-1600').trigger, 'catchup');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('period and status validation reject junk', () => {
  const root = tmp();
  try {
    assert.throws(() => ops.start(root, { period: 'not-a-period' }), /period/);
    assert.throws(() => ops.start(root, { period: '2026-10-13-0900', trigger: 'cron' }), /trigger/);
    ops.start(root, { period: '2026-10-13-0900' });
    assert.throws(() => ops.setStage(root, { period: '2026-10-13-0900', name: 'deploy', status: 'ok' }), /stage/);
    assert.throws(() => ops.setPage(root, { period: '2026-10-13-0900', page: 'shorts', status: 'ok' }), /page/);
    assert.throws(() => ops.finish(root, { period: '2026-10-13-0900', status: 'running' }), /finish status/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('docs and package wire ops:run; build does not publish ops-runs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.equal(pkg.scripts['ops:run'], 'node scripts/ops-run.js');
  const opsDoc = fs.readFileSync(path.join(__dirname, '../docs/GROK_BOT_OPERATIONS.md'), 'utf8');
  assert.match(opsDoc, /data\/ops-runs/);
  assert.match(opsDoc, /Activity task failed/);
  assert.match(opsDoc, /例行任务提示词附录/);
  const agents = fs.readFileSync(path.join(__dirname, '../AGENTS.md'), 'utf8');
  assert.match(agents, /ops-runs|ops:run/);
  const build = fs.readFileSync(path.join(__dirname, '../scripts/build-site.js'), 'utf8');
  assert.equal(build.includes('ops-runs'), false);
});

test('current period suffixes 0800/1500/2030 accepted; unknown slot rejected', () => {
  const root = tmp();
  try {
    for (const period of ['2026-10-16-0800', '2026-10-16-1500', '2026-10-16-2030']) {
      ops.start(root, { period, force: true });
      assert.equal(ops.readRun(root, period).period, period);
    }
    // legacy still readable for historical hang cleanup
    ops.start(root, { period: '2026-10-16-0900', force: true });
    assert.throws(() => ops.start(root, { period: '2026-10-16-0700' }), /period/);
    assert.throws(() => ops.start(root, { period: '2026-10-16-2130' }), /period/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
