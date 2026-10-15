#!/usr/bin/env node
/* One local consumer; D1 grants a fenced lease and serializes all publications. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {setTimeout:delay}=require('node:timers/promises');
const {prepareNews,preparePeopleIntelligence,prepareTickerIntelligence,prepareAiIntelligence,prepareShortsIntelligence}=require('./lib/update-results');
const {windowStart,displayWindow,readCoverage,recordCoverage,uncoveredRanges}=require('./lib/windows');
const {collectorPrompt}=require('./lib/update-prompt');
const {saveBrief}=require('./lib/stock-brief');
const {readJson,writeJson,sourceIndex}=require('./lib/x-data');
const HOME=process.env.INTELBRIEF_STATE_DIR||path.join(os.homedir(),'.local/share/intelbrief-updates');
const ROOT=path.resolve(__dirname,'..');
const CONFIG=process.env.INTELBRIEF_CONFIG||path.join(HOME,'config.json');
// Items from earlier editions still inside the 24h display window are shown alongside this edition.
function carriedOver(root,editions,job,start,input) {
  const {displayWindowStart}=displayWindow(job.cutoff);
  const fresh=new Set([...(input.focus||[]),...(input.insights||[])].map(e=>String(e.eventKey).trim().toLowerCase()));
  const out=[];
  for(const entry of editions.filter(e=>e.status!=='failed'&&Date.parse(e.scheduledFor)<Date.parse(job.cutoff)&&Date.parse(e.scheduledFor)>Date.parse(displayWindowStart))) {
    const file=path.join(root,'data/stock-briefs',entry.file);
    if(!fs.existsSync(file)) continue;
    const old=readJson(file);
    for(const group of ['focus','insights']) for(const event of old[group]||[]) {
      const key=String(event.eventKey).trim().toLowerCase();
      const source=(event.sources||[]).find(s=>Date.parse(s.publishedAt)>=Date.parse(displayWindowStart)&&Date.parse(s.publishedAt)<Date.parse(start));
      if(!source||fresh.has(key)||out.some(c=>c.eventKey.toLowerCase()===key)) continue;
      out.push({fromEdition:old.id,group,eventKey:event.eventKey,title:event.title,fact:event.fact,url:source.url,publishedAt:source.publishedAt});
    }
  }
  return out;
}
function run(command,args,{cwd=ROOT,stdin,signal,timeout=120000,env=process.env,log}={}) {
  return new Promise((resolve,reject)=> {
    const child=spawn(command,args,{cwd,env,signal,stdio:['pipe','pipe','pipe']});
    let output='',error='';
    const timer=setTimeout(()=>child.kill('SIGTERM'),timeout);
    const killTimer=setTimeout(()=>child.kill('SIGKILL'),timeout+5000);
    child.stdout.on('data',b=> {output=(output+b).slice(-1000000);if(log)fs.appendFileSync(log,b);});
    child.stderr.on('data',b=> {error=(error+b).slice(-1000000);if(log)fs.appendFileSync(log,b);});
    child.on('error',e=>{clearTimeout(timer);clearTimeout(killTimer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);clearTimeout(killTimer);code===0?resolve(output.trim()):reject(new Error(`${command} 未完成（${code??'中断'}）。详情保存在本机日志。`));});
    child.stdin.end(stdin||'');
  });
}
function client(config) {
  return async function api(endpoint,input) {
    const response=await fetch(new URL('/api/updates/'+endpoint,config.url),{method:'POST',headers:{Authorization:`Bearer ${config.runnerKey}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>({error:'更新服务返回无效响应'}));
    if(!response.ok) throw Object.assign(new Error(data.error||'更新服务不可用'),{status:response.status});
    return data;
  };
}
async function executeJob(job,config,api,{collect}={}) {
  // Production collection belongs to Grok Bot; injection remains for isolated tests only.
  if(!collect) throw new Error('旧 Codex 内容执行器已停用；由 Grok Bot「X+github」独立执行。');
  const dir=path.join(config.stateDir||HOME,'jobs',job.id), checkout=path.join(dir,'checkout'), resultFile=path.join(dir,'collector.json'), checkpointFile=path.join(dir,'checkpoint.json');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const abort=new AbortController();
  let lost=false, heartbeating=false, checkpoint=fs.existsSync(checkpointFile)?readJson(checkpointFile):{};
  const beat=async()=> {
    if(heartbeating) return;
    heartbeating=true;
    try {await api('runner/heartbeat',{runnerId:config.runnerId,id:job.id,lease:job.lease});}
    catch(error){lost=true;abort.abort();} finally {heartbeating=false;}
  };
  const heartbeat=setInterval(beat,20000);
  const assertLease=async()=>{if(lost)throw new Error('执行端连接中断，任务已暂停'); await beat();if(lost)throw new Error('任务租约失效，请重试');};
  const progress=async(stage,message,result)=> {await assertLease();await api('runner/progress',{id:job.id,lease:job.lease,stage,message,result});};
  const command=(cmd,args,opts={})=>run(cmd,args,{cwd:checkout,signal:abort.signal,log:path.join(dir,'runner.log'),...opts});
  const git=(...args)=>command('git',args);
  const saveCheckpoint=()=>writeJson(checkpointFile,checkpoint);
  try {
    if(!fs.existsSync(checkout)) {
      if(config.mode==='local') {
        fs.mkdirSync(checkout,{recursive:true});
        for(const name of ['scripts','sources','data','docs','config','knowledge']) fs.cpSync(path.join(ROOT,name),path.join(checkout,name),{recursive:true});
      } else await run('git',['clone','--single-branch','--branch','master',config.repository,checkout],{signal:abort.signal});
    }
    if(!checkpoint.prepared) {
      const registry=readJson(path.join(checkout,'sources/x-sources.json'));
      const editions=readJson(path.join(checkout,'data/stock-briefs/index.json')).editions;
      const previousPath=path.join(checkout,'data/people-checks.json');
      const previous=fs.existsSync(previousPath)?readJson(previousPath):{accounts:{}};
      const start=windowStart(editions,job);
      if(!fs.existsSync(resultFile)) {
        const window={...displayWindow(job.cutoff),uncovered:uncoveredRanges(readCoverage(checkout),job.page,start,job.cutoff)};
        const prompt=collectorPrompt(job,checkout,start,previous,window);
        if(collect) writeJson(resultFile,await collect(job,prompt));
      }
      await progress('validating','采集已结束，正在核验原帖与数据');
      const input=readJson(resultFile);
      if(!['grok-app','grok-web'].includes(input.collectionPath)) throw new Error('来源不符合要求：只允许本机 Grok Bot App 或 Grok 网页版');
      let outcome,files;
      if(job.page==='news') {
        const brief=prepareNews(input,job,start,sourceIndex(registry),new Date(),carriedOver(checkout,editions,job,start,input));
        const file=path.join(checkout,'data/stock-briefs',brief.id+'.json');
        // On a crash after writing, reuse the frozen edition instead of changing generatedAt.
        if(!fs.existsSync(file)) saveBrief(brief,checkout);
        else {
          const saved=readJson(file);
          if(saved.requestId!==job.id && job.trigger_type!=='scheduled') throw new Error('归档编号冲突');
          saveBrief(saved,checkout);
        }
        const saved=readJson(file);
        outcome={status:saved.status==='failed'?'failed':saved.status==='partial'?'partial':'complete',message:saved.status==='failed'?saved.shortfallReason:`已发布 ${saved.counts.focus} 条焦点＋${saved.counts.insights} 条洞察${saved.shortfallReason?'；'+saved.shortfallReason:''}`};
        files=[`data/stock-briefs/${brief.id}.json`,'data/stock-briefs/index.json'];
      } else if (job.page==='people') {
        const peopleConfig=readJson(path.join(checkout,'config/people-intelligence.json'));
        const peoplePath=path.join(checkout,'data/people-intelligence.json');
        const existing=fs.existsSync(peoplePath)?readJson(peoplePath):{items:[]};
        const result=preparePeopleIntelligence(input,peopleConfig,existing,job.cutoff);
        outcome={status:result.status,message:result.message};
        if(result.status==='failed') throw new Error(result.message+'：'+result.failures.map(report=>report.id+' '+report.note).join('；'));
        writeJson(peoplePath,result.data);
        files=['data/people-intelligence.json'];
      } else if (job.page==='tickers') {
        const tickerConfig=readJson(path.join(checkout,'config/ticker-intelligence.json'));
        const tickerPath=path.join(checkout,'data/ticker-intelligence.json');
        const existing=fs.existsSync(tickerPath)?readJson(tickerPath):{items:[]};
        const result=prepareTickerIntelligence(input,tickerConfig,existing,job.cutoff);
        outcome={status:result.status,message:result.message};
        if(result.status==='failed') throw new Error(result.message+'：'+result.failures.map(report=>report.id+' '+report.note).join('；'));
        writeJson(tickerPath,result.data);
        files=['data/ticker-intelligence.json'];
      } else if (job.page==='crypto') {
        throw new Error('加密栏目已暂时停用，不再采集');
      } else if (job.page==='ai') {
        const aiConfig=readJson(path.join(checkout,'config/ai-intelligence.json'));
        const aiPath=path.join(checkout,'data/ai-intelligence.json');
        const existing=fs.existsSync(aiPath)?readJson(aiPath):{items:[]};
        const result=prepareAiIntelligence(input,aiConfig,existing,job.cutoff);
        outcome={status:result.status,message:result.message};
        if(result.status==='failed') throw new Error(result.message+'：'+result.failures.map(report=>report.id+' '+report.note).join('；'));
        writeJson(aiPath,result.data);
        files=['data/ai-intelligence.json'];
      } else throw new Error('未知更新页面：'+job.page);
      // Record which time span and queries this job searched, for later dedupe.
      writeJson(path.join(checkout,'data/search-coverage.json'),recordCoverage(readCoverage(checkout),{jobId:job.id,page:job.page,start,end:job.cutoff,queries:job.page==='news'?(input.coverage?.queries||[]):(input.tabs||[]).map(t=>`${t.id}: ${t.note}`),recordedAt:new Date().toISOString()}));
      files.push('data/search-coverage.json');
      const marker=`data/update-receipts/${job.id}.json`;
      writeJson(path.join(checkout,marker),{id:job.id,page:job.page,cutoff:job.cutoff,...outcome,publishedAt:new Date().toISOString()});
      files.push(marker);
      await command(process.execPath,['scripts/validate-data.js']);
      checkpoint={prepared:true,files,outcome,marker};saveCheckpoint();
    }
    await progress('publishing','数据已核验，正在发布并确认线上版本');
    if(config.mode==='local') {
      if(!checkpoint.localPublished) {
        // Save local backups and publish the manifest/receipt after content files.
        for(const file of checkpoint.files) {
          await assertLease();
          const destination=path.join(ROOT,file),backup=path.join(dir,'before-publication',file);
          if(fs.existsSync(destination)&&!fs.existsSync(backup)) {fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(destination,backup);}
          fs.mkdirSync(path.dirname(destination),{recursive:true});
          fs.copyFileSync(path.join(checkout,file),destination+'.tmp');fs.renameSync(destination+'.tmp',destination);
        }
        await run(process.execPath,['scripts/build-site.js']);
        checkpoint.revision='local-'+job.id;checkpoint.localPublished=true;saveCheckpoint();
      }
    } else {
    if(!checkpoint.revision) {
      await git('add','--',...checkpoint.files);
      const staged=(await git('diff','--cached','--name-only')).split('\n').filter(Boolean);
      if(staged.some(f=>!checkpoint.files.includes(f))) throw new Error('发布目录含非本次修改，已停止');
      if(staged.length) await git('-c','user.name=intelbrief-bot','-c','user.email=intelbrief-bot@users.noreply.github.com','commit','-m',`data: update ${job.page} (${job.id})`);
      checkpoint.revision=await git('rev-parse','HEAD');saveCheckpoint();
    }
    await assertLease();
    // Rebase ordinary concurrent commits; retain all evidence and never force push/reset.
    await git('fetch','origin','master');
    try { await git('rebase','origin/master'); }
    catch(error) {await git('rebase','--abort').catch(()=>{});throw new Error('远端数据有冲突，发布已暂停；保留本期证据，需要合并后重试');}
    checkpoint.revision=await git('rev-parse','HEAD');saveCheckpoint();
    await git('push','origin','HEAD:master');
    }
    for(let i=0;i<60;i++) {
      await assertLease();
      try {
        const url=new URL(checkpoint.marker,config.url);url.searchParams.set('revision',checkpoint.revision);
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(response.ok && (await response.json()).id===job.id) {
          // Verify every affected artifact, not just a deployment status flag.
          for(const file of checkpoint.files) {
            const remote=new URL(file,config.url);remote.searchParams.set('revision',checkpoint.revision);
            const actual=await fetch(remote,{cache:'no-store',signal:AbortSignal.timeout(15000)});
            if(!actual.ok || JSON.stringify(await actual.json())!==JSON.stringify(readJson(path.join(checkout,file)))) throw new Error('线上数据尚未完整更新');
          }
          await progress(checkpoint.outcome.status,checkpoint.outcome.message,{verifiedAt:new Date().toISOString(),revision:checkpoint.revision});
          return;
        }
      } catch(error) {if(lost)throw error;}
      await delay(5000,undefined,{signal:abort.signal});
    }
    throw new Error('数据已提交，线上发布尚未确认；重试将继续核验，不重复采集');
  } catch(error) {
    if(!checkpoint.prepared && fs.existsSync(resultFile)) fs.unlinkSync(resultFile);
    if(!lost) await api('runner/progress',{id:job.id,lease:job.lease,stage:'failed',message:error.message}).catch(()=>{});
    console.error(`${job.page}: ${error.message}`);
  } finally {clearInterval(heartbeat);}
}
async function main() {
  const config=readJson(CONFIG);
  if(!config.url||!config.runnerKey||!config.runnerId||(!config.repository&&config.mode!=='local')) throw new Error('执行端配置不完整，请先运行 updates:setup');
  const api=client(config);
  console.log('内容更新执行端已启动；只执行已提交的任务。');
  do {
    try {
      await api('runner/heartbeat',{runnerId:config.runnerId});
      const {job}=await api('runner/claim',{runnerId:config.runnerId});
      if(job) await executeJob(job,config,api);
    } catch(error) {console.error(error.message);}
    if(process.argv.includes('--once')) break;
    await delay(15000);
  } while(true);
}
if(require.main===module) {
  console.error('旧 Codex 内容执行器已停用；请由 Grok Bot「X+github」独立启动、采集和发布。');
  process.exitCode=1;
}
module.exports={carriedOver,run,executeJob,client};
