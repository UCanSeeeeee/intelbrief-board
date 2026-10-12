#!/usr/bin/env node
// Read-only entry router. It never pulls, writes, launches a model or collects news.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const ROUTES = {
  status: ['docs/GROK_BOT_OPERATIONS.md'],
  code: ['docs/DESIGN_SYSTEM.md', 'package.json'],
  handoff: ['docs/AGENT_ENTRY.md', 'docs/GROK_BOT_OPERATIONS.md', 'docs/MANUAL_UPDATES.md'],
  news: ['docs/STOCK_BRIEF.md', 'docs/TRADING_DAY_READING.md', 'config/stock-brief.json', 'config/us-market-calendar.json'],
  people: ['docs/PEOPLE_INTELLIGENCE_ROADMAP.md', 'config/people-intelligence.json'],
  tickers: ['docs/TICKER_INTELLIGENCE.md', 'config/ticker-intelligence.json'],
  ai: ['docs/AI_INTELLIGENCE.md', 'config/ai-intelligence.json'],
  crypto: ['docs/CRYPTO_INTELLIGENCE.md', 'config/crypto-intelligence.json'],
  earnings: ['docs/EARNINGS_CALENDAR.md', 'config/earnings-calendar.json'],
  macro: ['docs/MACRO_EVENTS.md', 'config/macro-events.json']
};
const contentTasks = new Set(['news','people','tickers','ai','crypto','earnings','macro']);
function entry(role, task, root = ROOT) {
  if (!['gpt','grok'].includes(role)) throw new Error('必须明确角色 --role gpt 或 --role grok；这只是路由声明，不授予权限。');
  if (!Object.hasOwn(ROUTES, task)) throw new Error('未知任务；可选：' + Object.keys(ROUTES).join(', '));
  if (role === 'gpt' && contentTasks.has(task)) throw new Error('内容执行只由 Grok Bot「X+github」负责；GPT仅维护代码，查执行记录请用 --task status。');
  if (role === 'grok' && task === 'code') throw new Error('代码功能维护交给GPT；Grok仅处理内容运营与交接。');
  const docs = ['AGENTS.md','CONTEXT.md','TASKS.md',...ROUTES[task]];
  if (contentTasks.has(task)) {
    const config = JSON.parse(fs.readFileSync(path.join(root,'config/research-guidance.json'),'utf8'));
    docs.push('config/research-guidance.json', config.knowledgeBase, config.collectionSop);
  }
  const files = [...new Set(docs)];
  for (const file of files) {
    const absolute = path.resolve(root,file);
    if (!absolute.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(absolute)) throw new Error('入口文件缺失或越界：' + file);
  }
  return {role, task, files};
}
function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--role','--task'].includes(args[i]) || !args[i+1]) throw new Error('用法：npm run agent:enter -- --role gpt|grok --task status|code|handoff|news|people|tickers|ai|crypto|earnings|macro');
    options[args[i].slice(2)] = args[i+1];
  }
  const result = entry(options.role, options.task || 'status');
  const git = (...a) => execFileSync('git', a, {cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  console.log(`角色：${result.role === 'gpt' ? 'GPT代码维护' : 'Grok Bot内容运营'}；任务：${result.task}`);
  console.log('先读以下入口，再按本次授权推进：\n' + result.files.map(f => '- ' + f).join('\n'));
  console.log(`分支：${git('branch','--show-current')}；提交：${git('rev-parse','--short','HEAD')}`);
  console.log('工作区：\n' + (git('status','--short') || '干净'));
  console.log('本命令未联网、未修改。写入前仍须核对远端并 git pull --ff-only origin master；完成后测试、校验、构建、明确暂存、提交推送和必要的线上核验。');
  console.log('\n' + fs.readFileSync(path.join(ROOT,'TASKS.md'),'utf8'));
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {entry, ROUTES};
