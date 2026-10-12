const PAGES = ['news', 'people', 'tickers', 'ai', 'crypto'];
const ACTIVE = ['queued', 'running'];
const STAGES = ['collecting', 'validating', 'publishing'];
const COOKIE = '__Host-intelbrief';
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store', ...headers}});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const idOK = id => typeof id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(id);
const hex = bytes => [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
}
async function equal(a,b) {
  if (typeof a!=='string' || typeof b!=='string') return false;
  const salt=crypto.randomUUID(), x=await sign(salt,a), y=await sign(salt,b);
  let mismatch=0; for (let i=0;i<x.length;i++) mismatch |= x.charCodeAt(i)^y.charCodeAt(i);
  return mismatch===0;
}
async function authenticated(request, env) {
  const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if (!cookie) return false;
  const [expiry, nonce, signature] = cookie.split('.');
  if (!/^\d+$/.test(expiry)||Number(expiry)<Date.now()||!idOK(nonce)) return false;
  return equal(signature,await sign(env.UPDATE_ADMIN_KEY,`${expiry}.${nonce}`));
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('需要 JSON 请求',415);
  const text=await request.text();
  if (text.length>16000) fail('请求过大',413);
  try { return JSON.parse(text); } catch { fail('请求内容无效'); }
}
function publicJob(row) {
  const {lease,runner_id,lease_until,...job}=row;
  return {...job,result:row.result ? JSON.parse(row.result) : null};
}
async function expire(db, now) {
  await db.prepare("UPDATE jobs SET status='failed',stage='failed',message='执行中断，请重试；已发布内容保留',updated_at=? WHERE status='running' AND lease_until<?").bind(now,now).run();
  await db.prepare("UPDATE jobs SET status='failed',stage='failed',message='等待超过 30 分钟，恢复执行端后请重新更新',updated_at=? WHERE status='queued' AND created_at<?").bind(now,now-30*60000).run();
}
async function state(db, now) {
  const jobs=(await db.prepare('SELECT * FROM jobs ORDER BY created_at DESC, rowid DESC LIMIT 30').all()).results;
  const successes=(await db.prepare("SELECT * FROM jobs WHERE status IN ('complete','unchanged') ORDER BY updated_at DESC").all()).results;
  const latest=await db.prepare('SELECT MAX(seen_at) AS seen FROM runner').first();
  return {authenticated:true,online:!!latest?.seen && now-latest.seen<90000,jobs:jobs.map(publicJob),lastSuccess:Object.fromEntries(PAGES.map(page=>[page,successes.find(j=>j.page===page)?.updated_at || null]))};
}
async function enqueue(db, input, now, scheduled=false) {
  if (!idOK(input.requestId)) fail('请求编号无效');
  const previous=await db.prepare('SELECT job_ids FROM requests WHERE id=?').bind(input.requestId).first();
  if (previous) return JSON.parse(previous.job_ids);
  const pages=[...new Set(input.pages || [])];
  if (!pages.length || pages.some(p=>!PAGES.includes(p)) || (scheduled && (pages.length!==1 || pages[0]!=='news'))) fail('更新范围无效');
  if (scheduled && (!/^\d{4}-\d{2}-\d{2}T(?:09|16|21):00:00\+08:00$/.test(input.scheduledFor) || Date.parse(input.scheduledFor)>now)) fail('定时期次无效');
  const cutoff=scheduled ? new Date(input.scheduledFor).toISOString() : new Date(now).toISOString();
  const statements=pages.map(page=>db.prepare('INSERT OR IGNORE INTO jobs(id,page,trigger_type,cutoff,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),page,scheduled?'scheduled':'manual',cutoff,now,now));
  await db.batch(statements);
  const ids=[];
  for (const page of pages) {
    const job=scheduled
      ? await db.prepare("SELECT id FROM jobs WHERE trigger_type='scheduled' AND cutoff=?").bind(cutoff).first()
      : await db.prepare("SELECT id FROM jobs WHERE page=? AND status IN ('queued','running')").bind(page).first();
    // A manual news job may hold the page lock. Do not mislabel it as a scheduled edition.
    if (!job) fail('该页面正在更新，请在当前任务完成后重试',409);
    ids.push(job.id);
  }
  await db.prepare('INSERT OR IGNORE INTO requests(id,job_ids,created_at) VALUES(?,?,?)').bind(input.requestId,JSON.stringify(ids),now).run();
  return JSON.parse((await db.prepare('SELECT job_ids FROM requests WHERE id=?').bind(input.requestId).first()).job_ids);
}
// Best-effort per-isolate login throttle: 5 failures per IP per 10 minutes. Not a global guarantee.
const LOGIN_WINDOW=600000, LOGIN_MAX=5, loginFailures=new Map();
export function loginBlocked(ip,now=Date.now()) {
  const entry=loginFailures.get(ip);
  if (!entry || now-entry.start>LOGIN_WINDOW) { loginFailures.delete(ip); return false; }
  return entry.count>=LOGIN_MAX;
}
export function noteLoginFailure(ip,now=Date.now()) {
  const entry=loginFailures.get(ip);
  if (!entry || now-entry.start>LOGIN_WINDOW) loginFailures.set(ip,{start:now,count:1}); else entry.count++;
  if (loginFailures.size>5000) loginFailures.clear();
}
async function legacy(request, env) {
  try {
    if (!env.UPDATES_DB || !env.UPDATE_ADMIN_KEY || !env.UPDATE_RUNNER_KEY) return json({error:'网页直连尚未接通：后台配置不完整',configured:false},503);
    const db=env.UPDATES_DB, now=Date.now(), path=new URL(request.url).pathname;
    const runnerPath=path.startsWith('/api/updates/runner/') || path==='/api/updates/schedule';
    if (runnerPath) {
      if (!await equal(request.headers.get('Authorization'),`Bearer ${env.UPDATE_RUNNER_KEY}`)) fail('执行端未授权',401);
    } else {
      if (request.method!=='GET' && request.headers.get('Origin')!==new URL(request.url).origin) fail('请求来源无效',403);
      if (path==='/api/updates/login' && request.method==='POST') {
        const ip=request.headers.get('CF-Connecting-IP')||'local';
        if (loginBlocked(ip,now)) fail('登录失败次数过多，请 10 分钟后再试',429);
        const input=await body(request);
        if (!await equal(input.key,env.UPDATE_ADMIN_KEY)) { noteLoginFailure(ip,now); fail('管理密钥不正确',401); }
        loginFailures.delete(ip);
        const token=`${now+30*86400000}.${crypto.randomUUID()}`;
        return json({authenticated:true},200,{'Set-Cookie':`${COOKIE}=${token}.${await sign(env.UPDATE_ADMIN_KEY,token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`});
      }
      const local=env.LOCAL_UPDATES==='1' && ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
      if (!local && !await authenticated(request,env)) return json({authenticated:false,error:'登录后可更新内容'},401);
      if (path==='/api/updates/logout' && request.method==='POST') return json({authenticated:false},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
    }
    await expire(db,now);
    if (path==='/api/updates' && request.method==='GET') return json(await state(db,now));
    if ((path==='/api/updates' || path==='/api/updates/schedule') && request.method==='POST') {
      const ids=await enqueue(db,await body(request),now,path.endsWith('/schedule'));
      return json({...await state(db,now),jobIds:ids},202);
    }
    if (path==='/api/updates/retry' && request.method==='POST') {
      const input=await body(request);
      if (!Array.isArray(input.ids)||!input.ids.length||input.ids.length>PAGES.length||!input.ids.every(idOK)||new Set(input.ids).size!==input.ids.length) fail('重试范围无效');
      for (const id of input.ids) {
        const job=await db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
        if (!job || job.status!=='failed') continue;
        if (job.result) { await enqueue(db,{requestId:crypto.randomUUID(),pages:[job.page]},now); continue; }
        // Retry the same cutoff/archive; runner checkpoints prevent recollection after publication failures.
        await db.prepare("UPDATE OR IGNORE jobs SET status='queued',stage='queued',message='',created_at=?,updated_at=?,lease=NULL,lease_until=NULL,attempt=attempt+1 WHERE id=? AND status='failed'").bind(now,now,id).run();
      }
      return json(await state(db,now),202);
    }
    if (path==='/api/updates/runner/heartbeat' && request.method==='POST') {
      const input=await body(request);
      if (!idOK(input.runnerId)) fail('执行端编号无效');
      await db.prepare('INSERT INTO runner(id,seen_at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET seen_at=excluded.seen_at').bind(input.runnerId,now).run();
      if (input.id && input.lease) {
        const row=await db.prepare("UPDATE jobs SET lease_until=? WHERE id=? AND lease=? AND runner_id=? AND status='running' AND lease_until>=? RETURNING id").bind(now+120000,input.id,input.lease,input.runnerId,now).first();
        if (!row) fail('任务租约已失效',409);
      }
      return json({ok:true});
    }
    if (path==='/api/updates/runner/claim' && request.method==='POST') {
      const input=await body(request);
      if (!idOK(input.runnerId)) fail('执行端编号无效');
      const job=await db.prepare("UPDATE OR IGNORE jobs SET status='running',stage='collecting',updated_at=?,runner_id=?,lease=?,lease_until=? WHERE id=(SELECT id FROM jobs WHERE status='queued' ORDER BY created_at,rowid LIMIT 1) RETURNING *").bind(now,input.runnerId,crypto.randomUUID(),now+120000).first();
      return json({job:job||null});
    }
    if (path==='/api/updates/runner/progress' && request.method==='POST') {
      const input=await body(request), stage=input.stage;
      if (![...STAGES,'complete','partial','unchanged','failed'].includes(stage)) fail('任务阶段无效');
      const current=await db.prepare("SELECT * FROM jobs WHERE id=? AND lease=? AND status='running' AND lease_until>=?").bind(input.id,input.lease,now).first();
      if (!current) fail('任务租约已失效',409);
      if (STAGES.includes(stage) && STAGES.indexOf(stage)<STAGES.indexOf(current.stage)) fail('不能退回已完成阶段',409);
      const terminal=!STAGES.includes(stage);
      if (terminal && stage!=='failed' && (current.stage!=='publishing'||!input.result?.verifiedAt||!input.result?.revision)) fail('必须验证线上发布后才能完成',409);
      if (input.result && JSON.stringify(input.result).length>6000) fail('结果过大');
      await db.prepare('UPDATE jobs SET status=?,stage=?,message=?,result=?,updated_at=? WHERE id=? AND lease=? AND status=\'running\' AND lease_until>=?').bind(terminal?stage:'running',stage,String(input.message||'').slice(0,500),input.result?JSON.stringify(input.result):null,now,input.id,input.lease,now).run();
      return json({ok:true});
    }
    return json({error:'接口不存在'},404);
  } catch(error) { return json({error:error.status?error.message:'更新服务暂时不可用，请稍后重试'},error.status||503); }
}

// Grok webhook mode. All three values are copied verbatim from the routine panel into Cloudflare secrets.
// GROK_WEBHOOK_AUTH_HEADER is the complete Authorization header value shown in the panel; we never build or default one.
const ACTIVE_MS=30*60000, DISPATCH_TIMEOUT=10000;
export const webhookReady=env=>!!(env.UPDATES_DB&&env.UPDATE_ADMIN_KEY&&typeof env.GROK_WEBHOOK_URL==='string'&&/^https:\/\//.test(env.GROK_WEBHOOK_URL)&&env.GROK_WEBHOOK_KEY&&env.GROK_WEBHOOK_AUTH_HEADER);
function webhookInput(input, now) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('请求内容无效');
  if (Object.keys(input).some(k=>!['requestId','requestedAt','pages'].includes(k))) fail('只接受请求编号、时间和页面范围');
  if (!idOK(input.requestId)) fail('请求编号无效');
  const at=Date.parse(input.requestedAt);
  if (typeof input.requestedAt!=='string' || !/(Z|[+-]\d{2}:\d{2})$/.test(input.requestedAt) || !Number.isFinite(at) || at>now+5*60000 || at<now-7*86400000) fail('请求时间无效');
  if (!Array.isArray(input.pages)) fail('更新范围无效');
  const pages=PAGES.filter(p=>input.pages.includes(p));
  if (!pages.length || pages.length!==input.pages.length || input.pages.some(p=>!PAGES.includes(p))) fail('更新范围无效');
  return {requestId:input.requestId,requestedAt:input.requestedAt,pages};
}
const view=row=>({delivery:'grok-webhook',requestId:row.id,requestedAt:row.requested_at,pages:JSON.parse(row.pages),accepted:row.status==='accepted',unconfirmed:row.status==='unconfirmed'||row.status==='dispatching',status:row.status});
async function active(db, now) {
  await db.prepare("UPDATE webhook_requests SET status='unconfirmed',updated_at=? WHERE status='dispatching' AND updated_at<?").bind(now,now-60000).run();
  return (await db.prepare("SELECT * FROM webhook_requests WHERE status IN ('dispatching','accepted','unconfirmed') AND created_at>=? ORDER BY created_at").bind(now-ACTIVE_MS).all()).results;
}
async function dispatchWebhook(db, env, raw, now) {
  const input=webhookInput(raw, now);
  const same=await db.prepare('SELECT * FROM webhook_requests WHERE id=?').bind(input.requestId).first();
  if (same) return [view(same),200]; // idempotent: never redispatch the same id
  const merge=async()=>{
    for (const row of await active(db,now)) {
      const pages=JSON.parse(row.pages);
      if (input.pages.every(p=>pages.includes(p))) return [{...view(row),merged:true},200];
      if (input.pages.some(p=>pages.includes(p))) fail('部分页面已有进行中的请求，请等待其结果后再提交',409);
    }
    return null;
  };
  const existing=await merge(); if (existing) return existing;
  const inserted=await db.prepare("INSERT OR IGNORE INTO webhook_requests(id,requested_at,pages,status,created_at,updated_at) VALUES(?,?,?,'dispatching',?,?) RETURNING id").bind(input.requestId,input.requestedAt,JSON.stringify(input.pages),now,now).first();
  if (!inserted) {
    const again=await db.prepare('SELECT * FROM webhook_requests WHERE id=?').bind(input.requestId).first();
    if (again) return [view(again),200];
    const merged=await merge(); if (merged) return merged;
    fail('另一台设备正在提交，请稍后刷新',409);
  }
  let status='unconfirmed', code=null;
  try {
    const response=await fetch(env.GROK_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':env.GROK_WEBHOOK_AUTH_HEADER},body:JSON.stringify(input),signal:AbortSignal.timeout(DISPATCH_TIMEOUT),redirect:'manual'});
    code=response.status; status=response.ok?'accepted':'rejected';
  } catch { status='unconfirmed'; }
  await db.prepare('UPDATE webhook_requests SET status=?,http_status=?,updated_at=? WHERE id=?').bind(status,code,Date.now(),input.requestId).run();
  const row=await db.prepare('SELECT * FROM webhook_requests WHERE id=?').bind(input.requestId).first();
  if (status==='rejected') return [{...view(row),error:'Grok 入口未受理（HTTP '+code+'），未开始；可稍后用新请求重试'},502];
  return [view(row),202];
}
async function handleWebhook(request, env) {
  const db=env.UPDATES_DB, now=Date.now(), url=new URL(request.url), path=url.pathname;
  if (request.method!=='GET' && request.headers.get('Origin')!==url.origin) fail('请求来源无效',403);
  if (!await authenticated(request,env)) return json({authenticated:false,delivery:'grok-webhook',error:'登录后可更新内容'},401);
  if (path==='/api/updates' && request.method==='GET') return json({authenticated:true,delivery:'grok-webhook',active:(await active(db,now)).map(view)});
  if (path==='/api/updates' && request.method==='POST') { const [data,status]=await dispatchWebhook(db,env,await body(request),now); return json(data,status); }
  return json({error:'接口不存在'},404);
}
export async function handleUpdates(request, env) {
  try {
    if (webhookReady(env)) {
      const path=new URL(request.url).pathname;
      const isLogin=['/api/updates/login','/api/updates/logout'].includes(path)&&request.method==='POST';
      if (!isLogin) return await handleWebhook(request,env);
      if (request.headers.get('Origin')!==new URL(request.url).origin) fail('请求来源无效',403);
      return await legacy(request,{...env,UPDATE_RUNNER_KEY:'login-only'});
    }
    return await legacy(request,env);
  } catch(error) { return json({error:error.status?error.message:'更新服务暂时不可用，请稍后重试'},error.status||503); }
}
