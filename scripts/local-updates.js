#!/usr/bin/env node
// Retired before any filesystem, credential, network or process side effects.
console.error('旧 Codex 本地内容执行入口已停用；由 Grok Bot「X+github」独立执行。仅预览请使用 npm run dev。');
process.exit(1);
// Historical local queue implementation below; intentionally unreachable.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const state=path.join(os.homedir(),'.local/share/intelbrief-updates/local');
fs.mkdirSync(state,{recursive:true,mode:0o700});
const configFile=path.join(state,'config.json');
const config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{mode:'local',url:'http://localhost:8787/',runnerId:crypto.randomUUID(),runnerKey:crypto.randomBytes(32).toString('base64url'),adminKey:crypto.randomBytes(32).toString('base64url'),stateDir:state};
fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});
const localConfig=path.join(state,'wrangler.toml'),persist=path.join(state,'cloudflare');
fs.writeFileSync(localConfig,`name="intelbrief-board-local"\ncompatibility_date="2026-10-01"\npages_build_output_dir=${JSON.stringify(path.join(root,'dist'))}\n[[d1_databases]]\nbinding="UPDATES_DB"\ndatabase_name="intelbrief-local"\ndatabase_id="intelbrief-local"\n`);
fs.writeFileSync(path.join(state,'.dev.vars'),`LOCAL_UPDATES="1"\nUPDATE_ADMIN_KEY=${JSON.stringify(config.adminKey)}\nUPDATE_RUNNER_KEY=${JSON.stringify(config.runnerKey)}\n`,{mode:0o600});
const wrangler=path.join(root,'node_modules/.bin/wrangler');
execFileSync(process.execPath,['scripts/build-site.js'],{cwd:root,stdio:'inherit'});
execFileSync(wrangler,['d1','execute','intelbrief-local','--local','--file',path.join(root,'server/schema.sql'),'--config',localConfig,'--persist-to',persist],{cwd:state,stdio:'pipe'});
const website=spawn(wrangler,['pages','dev',path.join(root,'dist'),'--persist-to',persist,'--port','8787','--ip','127.0.0.1'],{cwd:state,stdio:'inherit'});
const runner=spawn(process.execPath,[path.join(root,'scripts/update-runner.js')],{cwd:root,env:{...process.env,INTELBRIEF_CONFIG:configFile},stdio:'inherit'});
let stopping=false;
function stop(){if(stopping)return;stopping=true;website.kill('SIGTERM');runner.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
website.on('exit',()=>{stop();});runner.on('exit',()=>{stop();});
console.log('本地完整模式：http://localhost:8787 · 本机免登录 · 调试模式，数据只写本机；需保留的改动请提交并推送。');
