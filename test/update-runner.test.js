const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {executeJob}=require('../scripts/update-runner');
const root=path.resolve(__dirname,'..');
test('runner collects only the chosen page, pushes data, verifies deployed bytes and resumes without recollecting',async()=> {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'intelbrief-runner-test-'));
  const seed=path.join(dir,'seed'),remote=path.join(dir,'remote.git');fs.mkdirSync(seed);
  const git=(cwd,...args)=>execFileSync('git',args,{cwd,stdio:'pipe'}).toString().trim();
  for(const item of ['scripts','sources','data','docs','config']) fs.cpSync(path.join(root,item),path.join(seed,item),{recursive:true});
  git(seed,'init','-b','master');git(seed,'add','.');git(seed,'-c','user.name=test','-c','user.email=test@example.test','commit','-m','fixture');
  git(dir,'clone','--bare',seed,remote);
  const server=http.createServer((request,response)=> {
    try { const file=new URL(request.url,'http://localhost').pathname.slice(1);const content=git(remote,'show','master:'+file);response.setHeader('Content-Type','application/json');response.end(content); }
    catch {response.writeHead(404);response.end('{}');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const cutoff=new Date().toISOString(),now=()=>new Date().toISOString();
    const config={url:`http://127.0.0.1:${server.address().port}/`,repository:remote,runnerId:crypto.randomUUID(),stateDir:path.join(dir,'state')};
    const job={id:crypto.randomUUID(),page:'people',trigger_type:'manual',cutoff,lease:crypto.randomUUID()};
    const stages=[];let collections=0;
    const api=async(endpoint,input)=> {if(endpoint.endsWith('/progress'))stages.push(input);return {ok:true};};
    const collect=async()=> {collections++;return {collectionPath:'grok-app',checkedAt:now(),tabs:['elon-musk','jensen-huang','donald-trump','trillion-leaders','research-reports'].map(id=>({id,status:'complete',note:'测试夹具：窗口内没有达到门槛的新增'})),items:[]};};
    await executeJob(job,config,api,{collect});
    assert.equal(stages.at(-1).stage,'unchanged');assert.ok(stages.at(-1).result.revision);
    assert.equal(git(remote,'show','master:data/stock-briefs/index.json'),fs.readFileSync(path.join(seed,'data/stock-briefs/index.json'),'utf8').trim());
    assert.ok(JSON.parse(git(remote,'show',`master:data/update-receipts/${job.id}.json`)).id===job.id);
    await executeJob({...job,lease:crypto.randomUUID()},config,api,{collect});
    assert.equal(collections,1);assert.equal(stages.at(-1).stage,'unchanged');
  } finally {await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
