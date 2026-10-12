const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=path.resolve(__dirname,'..');
const {preparePeople,preparePeopleIntelligence,prepareNews,windowStart}=require('../scripts/lib/update-results');
const {collectorPrompt}=require('../scripts/lib/update-prompt');
const {saveBrief}=require('../scripts/lib/stock-brief');

test('real D1 API: auth, CSRF, concurrent deduplication, leases, partial failure and retry',async()=> {
  const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:path.join(root,'_worker.js')},{type:'ESModule',path:path.join(root,'server/updates.mjs')}],modulesRoot:root,compatibilityDate:'2026-10-01',d1Databases:{UPDATES_DB:'test-updates'},bindings:{UPDATE_ADMIN_KEY:'test-only-admin-key',UPDATE_RUNNER_KEY:'test-only-runner-key'}}));
  try {
    const db=await mf.getD1Database('UPDATES_DB');
    await db.exec(fs.readFileSync(path.join(root,'server/schema.sql'),'utf8').replace(/\n/g,' '));
    const origin='https://example.com';let cookie='';
    async function call(endpoint='',input,runner=false,extra={}) {
      const response=await mf.dispatchFetch(origin+'/api/updates'+endpoint,{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(runner?{Authorization:'Bearer test-only-runner-key'}:{}),...extra},body:input?JSON.stringify(input):undefined});
      return {status:response.status,data:await response.json(),headers:response.headers};
    }
    assert.equal((await call()).status,401);
    assert.equal((await call('/login',{key:'incorrect'})).status,401);
    const login=await call('/login',{key:'test-only-admin-key'});assert.equal(login.status,200);
    assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('',{requestId:crypto.randomUUID(),pages:['news']},false,{Origin:'https://attacker.test'})).status,403);
    const requestId=crypto.randomUUID();
    const repeated=await Promise.all(Array.from({length:5},()=>call('',{requestId,pages:['news']})));
    repeated.forEach(r=>assert.equal(r.status,202));
    assert.equal(new Set(repeated.map(r=>r.data.jobIds[0])).size,1);
    const all=await call('',{requestId:crypto.randomUUID(),pages:['news','people']});
    assert.equal(all.data.jobs.length,2);
    const runnerId=crypto.randomUUID();
    await call('/runner/heartbeat',{runnerId},true);
    assert.equal((await call()).data.online,true);
    const claims=await Promise.all([call('/runner/claim',{runnerId},true),call('/runner/claim',{runnerId:crypto.randomUUID()},true)]);
    assert.equal(claims.filter(r=>r.data.job).length,1);
    const job=claims.find(r=>r.data.job).data.job;
    assert.equal((await call('/runner/progress',{id:job.id,lease:'bad',stage:'complete'},true)).status,409);
    assert.equal((await call('/runner/progress',{id:job.id,lease:job.lease,stage:'complete'},true)).status,409);
    await call('/runner/progress',{id:job.id,lease:job.lease,stage:'validating'},true);
    assert.equal((await call('/runner/progress',{id:job.id,lease:job.lease,stage:'collecting'},true)).status,409);
    await call('/runner/progress',{id:job.id,lease:job.lease,stage:'failed',message:'测试采集失败'},true);
    const second=(await call('/runner/claim',{runnerId},true)).data.job;
    assert.notEqual(second.page,job.page);
    await call('/runner/progress',{id:second.id,lease:second.lease,stage:'publishing'},true);
    await call('/runner/progress',{id:second.id,lease:second.lease,stage:'unchanged',result:{verifiedAt:new Date().toISOString(),revision:'test-only'}},true);
    const state=(await call()).data;
    assert.equal(state.jobs.find(j=>j.id===second.id).status,'unchanged');
    assert.ok(state.lastSuccess[second.page]);
    assert.equal(state.jobs.some(j=>'lease' in j),false);
    const retried=await call('/retry',{ids:[job.id]});assert.equal(retried.status,202);
    const retry=(await call('/runner/claim',{runnerId},true)).data.job;
    assert.equal(retry.id,job.id);assert.equal(retry.attempt,2);assert.notEqual(retry.lease,job.lease);
    assert.equal((await call('/runner/heartbeat',{runnerId,id:job.id,lease:job.lease},true)).status,409);
    await db.prepare('UPDATE jobs SET lease_until=0 WHERE id=?').bind(retry.id).run();
    assert.equal((await call()).data.jobs.find(j=>j.id===retry.id).status,'failed');
    assert.equal((await call('/runner/progress',{id:retry.id,lease:retry.lease,stage:'publishing'},true)).status,409);
    // A reload restores the same persisted result, without creating anything.
    assert.equal((await call()).data.jobs.length,2);
    await call('/logout',{});cookie='';assert.equal((await call()).status,401);
  } finally {await mf.dispose();}
});

test('manual editions freeze independently; manual updates never advance scheduled window',()=> {
  const cutoff='2026-10-11T10:42:00Z',job={id:crypto.randomUUID(),cutoff,trigger_type:'manual'};
  const brief=prepareNews({status:'failed',summary:'测试采集失败',marketContext:'测试',coverage:{method:'测试',queries:[],gaps:['无可用来源']},selectionRationale:'测试',excludedCandidates:[],focus:[],insights:[],shortfallReason:'测试失败',checklist:[]},job,'2026-10-11T08:00:00Z',new Map(),new Date('2026-10-11T11:00:00Z'));
  assert.equal(brief.id,'manual-'+job.id);
  const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'manual-edition-test-'));
  try {saveBrief(brief,dir);assert.throws(()=>saveBrief({...brief,summary:'changed'},dir),/禁止覆盖/);} finally{fs.rmSync(dir,{recursive:true,force:true});}
  const editions=[{scheduledFor:'2026-10-11T08:00:00Z',trigger:'scheduled',status:'complete'},{scheduledFor:'2026-10-11T10:00:00Z',trigger:'manual',status:'complete'}];
  assert.equal(windowStart(editions,{cutoff,trigger_type:'manual'}),'2026-10-11T10:00:00.000Z');
  assert.equal(windowStart(editions,{cutoff,trigger_type:'scheduled'}),'2026-10-11T08:00:00.000Z');
});

test('news collector keeps scheduled windows and requires a separate multidisciplinary pass',()=> {
  const prompt=collectorPrompt({page:'news',cutoff:'2026-10-11T13:00:00Z'},root,'2026-10-10T13:00:00.000Z',{});
  assert.match(prompt,/固定使用“X\+github”Bot/);
  assert.match(prompt,/旧“推特信息获取”Bot仅保留历史对话，不再使用/);
  assert.match(prompt,/禁止用手动测试或手动更新的时间自行缩短、推进或替代/);
  assert.match(prompt,/必须执行两个可审计的独立阶段/);
  assert.match(prompt,/不得把第一轮余下候选直接改名为多学科结果/);
  assert.match(prompt,/<project-knowledge-base>/);
  assert.match(prompt,/P1｜半导体：AI 主线的核心/);
  assert.match(prompt,/P2｜电力：AI 扩张的第二层约束/);
  assert.match(prompt,/P3｜AI 落地：收入和利润是否真正兑现/);
  assert.match(prompt,/<grok-collection-sop>/);
  assert.match(prompt,/第二轮必须重新生成查询和搜索/);
  assert.match(prompt,/半导体、电力、AI落地三个核心产业包/);
});

test('people collector receives the same project knowledge and SOP',()=> {
  const prompt=collectorPrompt({page:'people',cutoff:'2026-10-11T13:00:00Z'},root,'2026-10-10T13:00:00.000Z',{});
  assert.match(prompt,/<project-knowledge-base>/);
  assert.match(prompt,/<grok-collection-sop>/);
  assert.match(prompt,/必须依照项目知识库与SOP用Grok在X中检索/);
  assert.match(prompt,/Grok先读取已授权仓库中的项目知识库/);
  assert.match(prompt,/不得读取或外传仓库外私有知识库/);
  assert.match(prompt,/后续归档、校验、提交推送及线上核验仍由Grok Bot/);
  assert.doesNotMatch(prompt,/使用电脑控制工具操作本机/);
});

test('people updates preserve other pages, reject fabricated identity and only advance complete accounts',()=> {
  const registry={accounts:[{username:'Alice',enabled:true,category:'people'},{username:'Bob',enabled:true,category:'people'}]};
  const now=new Date('2026-10-11T12:00:00Z'),cutoff='2026-10-11T11:00:00Z';
  const raw={posts:[{id:'900',author:{username:'Organization'},category:'ai',text:'Existing evidence',createdAt:'2026-10-11T01:00:00Z'}]};
  const prior={accounts:{bob:{lastSuccessAt:'2026-10-10T00:00:00Z'}}};
  const input={accounts:[{username:'Alice',status:'complete',checkedAt:now.toISOString(),note:'完整检查窗口'},{username:'Bob',status:'failed',checkedAt:now.toISOString(),note:'登录失效'}],posts:[{id:'100',url:'https://x.com/Alice/status/100',author:{username:'Alice'},text:'Full original text',createdAt:'2026-10-11T10:00:00Z',verification:'collector-report',verificationNote:'Grok返回，未独立直读'}]};
  const result=preparePeople(input,registry,raw,prior,cutoff,now);
  assert.equal(result.status,'partial');assert.equal(result.added,1);
  assert.deepEqual(result.posts.find(p=>p.id==='900'),raw.posts[0]);
  assert.equal(result.checkpoints.accounts.bob.lastSuccessAt,prior.accounts.bob.lastSuccessAt);
  assert.equal(result.checkpoints.accounts.alice.lastSuccessAt,cutoff);
  const again=preparePeople(input,registry,{posts:result.posts},prior,cutoff,now);assert.equal(again.added,0);
  const bad=structuredClone(input);bad.posts[0].url='https://x.com/Bob/status/100';assert.throws(()=>preparePeople(bad,registry,raw,prior,cutoff,now),/不一致/);
  bad.posts[0]=structuredClone(input.posts[0]);bad.posts[0].verification='direct';assert.throws(()=>preparePeople(bad,registry,raw,prior,cutoff,now),/未独立直读/);
  bad.posts[0]=structuredClone(input.posts[0]);bad.posts[0].createdAt='2026-10-11T11:01:00Z';assert.throws(()=>preparePeople(bad,registry,raw,prior,cutoff,now),/晚于截止/);
});

test('people intelligence enforces per-tab limits, weekly ranks and real X evidence',()=> {
  const config=JSON.parse(fs.readFileSync(path.join(root,'config/people-intelligence.json'),'utf8'));
  const cutoff='2026-10-11T11:00:00Z',now=new Date('2026-10-11T12:00:00Z');
  const tabs=config.tabs.map(tab=>({id:tab.id,status:'complete',note:'已完整检索滚动七天与最近24小时'}));
  const item={eventKey:'event-1',tabIds:['trillion-leaders'],title:'资本开支发生变化',fact:'公司给出新的资本开支数字',whyItMatters:'变化可能影响AI半导体需求与供给预期',counterCase:'仍需等待正式文件验证执行节奏',affected:['半导体'],author:'Example',publishedAt:'2026-10-11T10:00:00Z',url:'https://x.com/example/status/100',verification:'collector-report',tier:'must-read',weeklyRanks:{'trillion-leaders':1}};
  const result=preparePeopleIntelligence({checkedAt:now.toISOString(),tabs,items:[item]},config,{items:[]},cutoff,now);
  assert.equal(result.status,'complete');assert.equal(result.data.items.length,1);
  const tooMany=Array.from({length:11},(_,index)=>({...item,eventKey:`event-${index}`,url:`https://x.com/example/status/${100+index}`,weeklyRanks:{}}));
  assert.throws(()=>preparePeopleIntelligence({checkedAt:now.toISOString(),tabs,items:tooMany},config,{items:[]},cutoff,now),/近\d+天条目超过上限/);
  const bad=structuredClone(item);bad.url='https://example.com/post/100';
  assert.throws(()=>preparePeopleIntelligence({checkedAt:now.toISOString(),tabs,items:[bad]},config,{items:[]},cutoff,now),/真实或唯一X原帖/);
});

test('tickers collector prompt is equity-only and excludes crypto', () => {
  const {collectorPrompt}=require('../scripts/lib/update-prompt');
  const prompt=collectorPrompt({page:'tickers',cutoff:'2026-10-11T13:00:00Z'},root,'2026-10-10T13:00:00.000Z',{});
  assert.match(prompt,/只更新“具体个股”/);
  assert.match(prompt,/禁止混入 BTC/);
  assert.doesNotMatch(prompt,/0xfa6d9b504848606eb9aec04ccc161d169b3f2159/i);
});

test('crypto collector prompt covers board BTC Brew and contract', () => {
  const {collectorPrompt}=require('../scripts/lib/update-prompt');
  const prompt=collectorPrompt({page:'crypto',cutoff:'2026-10-11T13:00:00Z'},root,'2026-10-10T13:00:00.000Z',{});
  assert.match(prompt,/只更新“加密”/);
  assert.match(prompt,/加密板块讯息/);
  assert.match(prompt,/\$BTC/);
  assert.match(prompt,/0xfa6d9b504848606eb9aec04ccc161d169b3f2159/i);
});

test('ai collector prompt covers labs and GOOG boundary', () => {
  const {collectorPrompt}=require('../scripts/lib/update-prompt');
  const prompt=collectorPrompt({page:'ai',cutoff:'2026-10-11T13:00:00Z'},root,'2026-10-10T13:00:00.000Z',{});
  assert.match(prompt,/只更新“AI板块”/);
  assert.match(prompt,/OPENAI/);
  assert.match(prompt,/ANTHROPIC/);
  assert.match(prompt,/避免重复/);
});
