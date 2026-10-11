#!/usr/bin/env node
// The existing native scheduler calls this; no second cron is installed.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {slotAt}=require('./lib/stock-brief');
const {client}=require('./update-runner');
async function main() {
  const config=JSON.parse(fs.readFileSync(path.join(process.env.INTELBRIEF_STATE_DIR||path.join(os.homedir(),'.local/share/intelbrief-updates'),'config.json'),'utf8'));
  const slot=slotAt().previous;
  const result=await client(config)('schedule',{requestId:`scheduled-${slot.id}`,pages:['news'],scheduledFor:slot.scheduledFor});
  console.log(JSON.stringify({scheduledFor:slot.scheduledFor,jobIds:result.jobIds,online:result.online}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
