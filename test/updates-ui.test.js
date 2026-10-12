const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const contract=require('../update-receipt'),crypto=require('node:crypto');
async function boot({status=503,body={configured:false},saved=null,receipt=null,clipFails=false,storageFails=false}={}){
  const elements=new Map(),listeners=new Map(),requests=[],events=[],store=new Map();let interval,clipboard='';
  if(saved)store.set('intelbrief-manual-request-v2',JSON.stringify(saved));
  function element(){const ev=new Map();return {hidden:false,disabled:false,textContent:'',value:'',open:false,setAttribute(){},after(){},append(){},focus(){this.focused=true;},select(){this.selected=true;},addEventListener(n,f){ev.set(n,f);},showModal(){this.open=true;},close(){this.open=false;ev.get('close')?.();},
    set innerHTML(html){this.html=html;for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element());},get innerHTML(){return this.html||'';}};}
  const sidebar=element(),header=element(),created=[];
  const document={body:{dataset:{page:'news'},append(){}},hidden:false,createElement(){const node=element();created.push(node);return node;},getElementById(id){return elements.get(id);},querySelector(s){return s==='.page-header'?header:sidebar;},addEventListener(n,f){listeners.set(n,f);},dispatchEvent(e){events.push(e);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../updates.js'),'utf8'),{
    document,Intl,AbortSignal,IntelUpdateReceipt:contract,crypto:crypto.webcrypto,CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts.detail;}},confirm:()=>true,
    localStorage:{getItem:k=>{if(storageFails)throw Error();return store.get(k);},setItem:(k,v)=>{if(storageFails)throw Error();store.set(k,v);},removeItem:k=>store.delete(k)},navigator:{clipboard:{writeText:async t=>{if(clipFails)throw Error();clipboard=t;}}},
    fetch:async(url,opts)=>{requests.push({url,opts});if(url.startsWith('/api/'))return new Response(JSON.stringify(body),{status});if(url.startsWith('/data/update-receipts/'))return new Response(JSON.stringify(receipt||{}),{status:receipt?200:404});return new Response('{}');},setInterval(fn){interval=fn;}
  });
  await new Promise(r=>setImmediate(r));return {elements,created,requests,events,store,interval,clipboard:()=>clipboard};
}
test('disconnected action explains copy handoff, never pretends it dispatched',async()=>{
  const ui=await boot();const e=ui.elements;
  assert.equal(e.has('update-jobs'),false);assert.equal(ui.created[2].hidden,false);
  assert.equal(e.get('update-page').disabled,false);e.get('update-page').onclick();
  assert.equal(ui.created[3].open,true);assert.match(e.get('update-explanation').textContent,/不能直接/);
  await e.get('update-copy').onclick();assert.match(ui.clipboard(),/请求编号/);assert.match(e.get('update-result').textContent,/尚未发送/);
  assert.equal(ui.requests.filter(r=>r.opts?.method==='POST').length,0);
  await e.get('update-sent').onclick();assert.match(e.get('update-last').textContent,/等待本次结果/);
  const before=e.get('update-request-number').textContent;e.get('update-all').onclick();assert.equal(e.get('update-request-number').textContent,before);
});
test('clipboard and storage failures keep a manual escape hatch',async()=>{
  const {elements:e}=await boot({clipFails:true,storageFails:true});e.get('update-page').onclick();await e.get('update-copy').onclick();
  assert.equal(e.get('update-prompt').hidden,false);assert.equal(e.get('update-prompt').selected,true);assert.match(e.get('update-explanation').textContent,/无法保存/);
});
test('old queue online is not Grok capability; new connection preserves login',async()=>{
  const old=await boot({status:200,body:{authenticated:true,online:true}});old.elements.get('update-page').onclick();assert.equal(old.elements.get('update-confirm').hidden,true);
  const live=await boot({status:401,body:{delivery:'grok-webhook'}});const e=live.elements;e.get('update-page').onclick();assert.equal(e.get('update-login').hidden,false);await e.get('update-confirm').onclick();assert.equal(e.get('update-key').focused,true);
});
test('receipt can close a request and retry only failures; no callback needed',async()=>{
  const saved={requestId:'request-12345',requestedAt:new Date().toISOString(),pages:['news','people'],delivery:'manual'};
  const receipt={schemaVersion:2,requestId:saved.requestId,requestedAt:saved.requestedAt,completedAt:saved.requestedAt,results:[{page:'news',status:'failed',message:'采集失败',artifacts:[]},{page:'people',status:'unchanged',message:'真实核验后无新增',artifacts:[{path:'data/people-intelligence.json',sha256:crypto.createHash('sha256').update('{}').digest('hex')}]}]};
  const ui=await boot({saved,receipt});await new Promise(r=>setTimeout(r,20));const e=ui.elements;
  assert.match(e.get('update-last').textContent,/结果已核对/);assert.match(e.get('update-connection').textContent,/更新失败/);assert.equal(ui.events.length,1);
  e.get('update-retry').onclick();assert.match(e.get('update-scope').textContent,/美股讯息/);assert.doesNotMatch(e.get('update-scope').textContent,/具体人物/);
});
test('timeout stops automatic polling, does not call it failure or submit again',async()=>{
  const saved={requestId:'timeout-request',requestedAt:new Date(Date.now()-31*60000).toISOString(),pages:['news'],delivery:'manual'};
  const ui=await boot({saved});const before=ui.requests.length;ui.interval();await new Promise(r=>setImmediate(r));
  assert.equal(ui.requests.length,before);assert.match(ui.elements.get('update-connection').textContent,/不代表任务失败/);
  await ui.elements.get('update-check').onclick();assert.ok(ui.requests.length>before);
});
test('direct acceptance is not completion, ambiguous delivery is never auto-resubmitted',async()=>{
  for(const accepted of [true,false]){
    const ui=await boot({status:200,body:{authenticated:true,delivery:'grok-webhook',accepted}}),e=ui.elements;
    e.get('update-page').onclick();assert.equal(e.get('update-title').focused,true);
    await e.get('update-confirm').onclick();assert.doesNotMatch(e.get('update-last').textContent,/已核对|更新完成/);
    assert.match(e.get('update-result').textContent,accepted ? /入口已受理/ : /未确认送达/);
    const posts=()=>ui.requests.filter(r=>r.opts?.method==='POST').length;
    assert.equal(posts(),1);await e.get('update-confirm').onclick();ui.interval();assert.equal(posts(),1);
  }
});
