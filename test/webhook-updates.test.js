// Isolated: fake webhook endpoint only, never real Grok; no data/ files written.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=path.resolve(__dirname,'..');
async function setup(bindings,hook){
  const calls=[];
  const mf=new Miniflare(convertV4MiniflareOptions({modules:[{type:'ESModule',path:path.join(root,'_worker.js')},{type:'ESModule',path:path.join(root,'server/updates.mjs')}],modulesRoot:root,compatibilityDate:'2026-10-01',d1Databases:{UPDATES_DB:'t'+crypto.randomUUID()},bindings,
    outboundService:async req=>{calls.push({url:req.url,auth:req.headers.get('authorization'),body:await req.json()});return hook(calls.length);}}));
  const db=await mf.getD1Database('UPDATES_DB');
  await db.exec(fs.readFileSync(path.join(root,'server/schema.sql'),'utf8').replace(/\n/g,' '));
  const origin='https://example.com';let cookie='';
  async function call(endpoint='',input,extra={}){const r=await mf.dispatchFetch(origin+'/api/updates'+endpoint,{method:input?'POST':'GET',headers:{...(input?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:input?JSON.stringify(input):undefined});return {status:r.status,data:await r.json(),headers:r.headers};}
  async function login(){const l=await call('/login',{key:'test-only-admin'});cookie=l.headers.get('set-cookie')?.split(';')[0]||'';return l;}
  return {mf,db,call,login,calls};
}
const full={UPDATE_ADMIN_KEY:'test-only-admin',GROK_WEBHOOK_URL:'https://hook.test/fake',GROK_WEBHOOK_KEY:'test-only-key',GROK_WEBHOOK_AUTH_HEADER:'TestScheme test-only-key'};
const req=(pages=['news'])=>({requestId:crypto.randomUUID(),requestedAt:new Date().toISOString(),pages});

test('missing any dependency (incl. auth header) disables dispatch; no Bearer default, no false accepted',async()=>{
  for(const drop of ['GROK_WEBHOOK_URL','GROK_WEBHOOK_KEY','GROK_WEBHOOK_AUTH_HEADER']){
    const b={...full};delete b[drop];const t=await setup(b,()=>new Response('ok'));
    try{const g=await t.call();assert.notEqual(g.data.delivery,'grok-webhook');const p=await t.call('',req());assert.notEqual(p.data.accepted,true);assert.equal(t.calls.length,0);}finally{await t.mf.dispose();}
  }
});
test('unauthorized, cross-origin, whitelist and arbitrary prompt rejected',async()=>{
  const t=await setup(full,()=>new Response('ok'));
  try{
    const u=await t.call();assert.equal(u.status,401);assert.equal(u.data.delivery,'grok-webhook');
    assert.equal((await t.call('',req())).status,401);
    assert.equal((await t.call('/login',{key:'wrong'})).status,401);
    await t.login();
    assert.equal((await t.call('',req(),{Origin:'https://attacker.test'})).status,403);
    assert.equal((await t.call('',req(['shorts']))).status,400);
    assert.equal((await t.call('',{...req(),prompt:'rm -rf'})).status,400);
    assert.equal((await t.call('/runner/claim',{runnerId:crypto.randomUUID()},{Authorization:'Bearer login-only'})).status,404);
    assert.equal(t.calls.length,0);
  }finally{await t.mf.dispose();}
});
test('2xx accepted with exact header/body; double-click and multi-device dedupe',async()=>{
  const t=await setup(full,()=>new Response('ok'));
  try{
    await t.login();const r=req(['news']);
    const clicks=await Promise.all(Array.from({length:4},()=>t.call('',r)));
    assert.equal(t.calls.length,1);assert.equal(t.calls[0].auth,full.GROK_WEBHOOK_AUTH_HEADER);
    assert.deepEqual(Object.keys(t.calls[0].body).sort(),['pages','requestId','requestedAt']);
    assert.ok(clicks.every(c=>c.data.requestId===r.requestId||c.status===409));
    assert.equal((await t.call('',r)).data.accepted,true);
    const other=await t.call('',req(['news']));assert.equal(other.data.merged,true);assert.equal(other.data.requestId,r.requestId);
    assert.equal((await t.call('',req(['news','people']))).status,409);
    const all=await t.call('',req(['news','people','tickers','ai','crypto'].slice(1)));assert.equal(all.data.accepted,true);
    assert.equal(t.calls.length,2);
  }finally{await t.mf.dispose();}
});
test('non-2xx is not accepted; timeout is unconfirmed and never redispatched',async()=>{
  const t=await setup(full,n=>n===1?new Response('no',{status:401}):new Promise(()=>{}));
  try{
    await t.login();
    const bad=await t.call('',req(['ai']));assert.equal(bad.status,502);assert.equal(bad.data.accepted,false);
    const r=req(['ai']);const slow=await t.call('',r);
    assert.equal(slow.status,202);assert.equal(slow.data.accepted,false);assert.equal(slow.data.unconfirmed,true);assert.equal(slow.data.requestId,r.requestId);
    const again=await t.call('',r);assert.equal(again.data.unconfirmed,true);assert.equal(t.calls.length,2);
  }finally{await t.mf.dispose();}
});
