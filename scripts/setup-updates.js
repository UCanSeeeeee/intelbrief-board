#!/usr/bin/env node
/* Provision existing Pages project after `wrangler login`; secrets travel on stdin. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const state=process.env.INTELBRIEF_STATE_DIR||path.join(os.homedir(),'.local/share/intelbrief-updates');
const configFile=path.join(state,'config.json');
const wrangler=path.join(root,'node_modules/.bin/wrangler');
const run=(args,opts={})=>execFileSync(wrangler,args,{cwd:root,encoding:'utf8',...opts});
async function main() {
  fs.mkdirSync(state,{recursive:true,mode:0o700});fs.chmodSync(state,0o700);
  const config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{url:'https://intelbrief-board.pages.dev/',repository:'https://github.com/UCanSeeeeee/intelbrief-board.git',runnerId:crypto.randomUUID(),runnerKey:crypto.randomBytes(32).toString('base64url'),adminKey:crypto.randomBytes(32).toString('base64url'),codex:'codex'};
  const save=()=>fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});save();fs.chmodSync(configFile,0o600);
  if(process.argv.includes('--local-only')) {console.log(`执行端配置已保存在 ${configFile}；未连接云端。`);return;}
  const auth=run(['whoami']);
  if(/not authenticated/i.test(auth)) throw new Error('Cloudflare 尚未登录。运行 npx wrangler login 完成连接，再重跑本命令。');
  let list=JSON.parse(run(['d1','list','--json']));
  let database=list.find(item=>item.name==='intelbrief-updates');
  if(!database) {
    run(['d1','create','intelbrief-updates']);
    list=JSON.parse(run(['d1','list','--json']));database=list.find(item=>item.name==='intelbrief-updates');
  }
  if(!database) throw new Error('未找到新建的任务数据库');
  const file=path.join(root,'wrangler.toml');
  let toml=fs.readFileSync(file,'utf8');
  if(!toml.includes('binding = "UPDATES_DB"')) toml+=`\n[[d1_databases]]\nbinding = "UPDATES_DB"\ndatabase_name = "intelbrief-updates"\ndatabase_id = "${database.uuid}"\n`;
  fs.writeFileSync(file,toml);
  run(['d1','execute','intelbrief-updates','--remote','--file','server/schema.sql','--yes']);
  for(const [key,value] of [['UPDATE_ADMIN_KEY',config.adminKey],['UPDATE_RUNNER_KEY',config.runnerKey]]) run(['pages','secret','put',key,'--project-name','intelbrief-board'],{input:value});
  config.provisionedAt=new Date().toISOString();save();
  console.log('任务数据库与更新凭证已配置。部署后运行 npm run updates:start。');
  console.log(`管理密钥仅保存在本机 ${configFile} 的 adminKey 字段；在网站更新面板中登录。`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
