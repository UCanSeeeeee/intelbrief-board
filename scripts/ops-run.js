#!/usr/bin/env node
// CLI for durable content-run logs. Does not collect, commit, or push by itself.
const path = require('node:path');
const ops = require('./lib/ops-run');
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Error(`未知参数：${a}`);
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next == null || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return { command, flags };
}

function usage() {
  return `用法：
  npm run ops:run -- start  --period <id> [--trigger scheduled|manual|catchup] [--note "..."] [--force]
  npm run ops:run -- stage  --period <id> --name pull|read|search|write|validate|push|verify --status ok|failed|skipped [--detail "..."]
  npm run ops:run -- page   --period <id> --page news|people|tickers|ai|crypto|earnings|macro --status ok|partial|failed|skipped|unchanged [--detail "..."]
  npm run ops:run -- fail   --period <id> --message "..." [--stage <name>] [--stack "..."]
  npm run ops:run -- finish --period <id> --status success|partial|failed [--commit <hash>] [--note "..."]
  npm run ops:run -- show   --period <id>
  npm run ops:run -- latest

日志写在 data/ops-runs/<period>.json 与 data/ops-runs/latest.json。
不入库密钥。若平台在代码启动前失败（如 Activity task failed），仓库里不会有本日志。`;
}

function main(argv) {
  const { command, flags } = parseArgs(argv);
  if (!command || command === 'help' || flags.help) {
    console.log(usage());
    return;
  }
  if (command === 'start') {
    const notes = flags.note ? [String(flags.note)] : [];
    const file = ops.start(ROOT, {
      period: flags.period,
      trigger: flags.trigger || 'scheduled',
      notes,
      force: Boolean(flags.force)
    });
    console.log(path.relative(ROOT, file));
    return;
  }
  if (command === 'stage') {
    const file = ops.setStage(ROOT, {
      period: flags.period,
      name: flags.name,
      status: flags.status,
      detail: flags.detail
    });
    console.log(path.relative(ROOT, file));
    return;
  }
  if (command === 'page') {
    const file = ops.setPage(ROOT, {
      period: flags.period,
      page: flags.page,
      status: flags.status,
      detail: flags.detail
    });
    console.log(path.relative(ROOT, file));
    return;
  }
  if (command === 'fail') {
    if (!flags.message) throw new Error('fail 需要 --message');
    const file = ops.fail(ROOT, {
      period: flags.period,
      stage: flags.stage || null,
      message: flags.message,
      stack: flags.stack || null
    });
    console.log(path.relative(ROOT, file));
    return;
  }
  if (command === 'finish') {
    const file = ops.finish(ROOT, {
      period: flags.period,
      status: flags.status,
      commitHash: flags.commit || null,
      note: flags.note || null
    });
    console.log(path.relative(ROOT, file));
    return;
  }
  if (command === 'show') {
    const run = ops.readRun(ROOT, flags.period);
    if (!run) throw new Error(`没有日志：${flags.period}`);
    console.log(JSON.stringify(ops.summarize(run), null, 2));
    return;
  }
  if (command === 'latest') {
    const file = ops.latestPath(ROOT);
    const fs = require('node:fs');
    if (!fs.existsSync(file)) {
      console.log('尚无 latest.json（从未成功写出 ops-run，或平台在代码启动前失败）');
      return;
    }
    console.log(fs.readFileSync(file, 'utf8').trimEnd());
    return;
  }
  throw new Error(usage());
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
