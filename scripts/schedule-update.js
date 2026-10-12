#!/usr/bin/env node
// The existing native scheduler calls this; no second cron is installed.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {slotAt}=require('./lib/stock-brief');
const {client}=require('./update-runner');
function stateConfig() {
  const file=path.join(process.env.INTELBRIEF_STATE_DIR||path.join(os.homedir(),'.local/share/intelbrief-updates'),'config.json');
  if(!fs.existsSync(file)) throw new Error(`未找到执行端配置 ${file}；请先运行 npm run updates:setup 完成云端接入，或设置 INTELBRIEF_STATE_DIR`);
  try { return JSON.parse(fs.readFileSync(file,'utf8')); }
  catch(error) { throw new Error(`执行端配置 ${file} 不是有效 JSON：${error.message}`); }
}
async function main() {
  const config=stateConfig();
  const slot=slotAt().previous;
  // requestId is deterministic per slot, and D1 has a unique index on scheduled cutoffs, so repeats are idempotent.
  const result=await client(config)('schedule',{requestId:`scheduled-${slot.id}`,pages:['news'],scheduledFor:slot.scheduledFor});
  console.log(JSON.stringify({scheduledFor:slot.scheduledFor,jobIds:result.jobIds,online:result.online}));
}
main().catch(error=>{console.error(`提交定时期次失败：${error.message}`);process.exitCode=1;});
