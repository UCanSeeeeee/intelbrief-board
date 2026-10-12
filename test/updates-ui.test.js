const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

async function boot(status,body) {
  const elements=new Map(),listeners=new Map();
  function element() {
    return {hidden:false,disabled:false,textContent:'',value:'',setAttribute(){},after(){},append(){},focus(){this.focused=true;},
      set innerHTML(html) {this.html=html; for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1],element());},
      get innerHTML(){return this.html||'';}};
  }
  const sidebar=element(),header=element(),created=[];
  const document={body:{dataset:{page:'news'}},hidden:false,
    createElement(){const node=element();created.push(node);return node;},
    getElementById(id){return elements.get(id);},
    querySelector(selector){return selector==='.page-header'?header:sidebar;},
    addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../updates.js'),'utf8'),{
    document,Intl,AbortSignal,crypto:require('node:crypto').webcrypto,
    fetch:async()=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}),setInterval(){},
  });
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,created};
}

test('removed history leaves controls and honest disconnected state',async()=>{
  const {elements,created}=await boot(503,{configured:false,error:'更新服务尚未接通，请完成后台配置'});
  assert.equal(elements.has('update-toggle'),false);
  assert.equal(elements.has('update-jobs'),false);
  assert.equal(elements.has('update-close'),false);
  assert.equal(created[2].hidden,false);
  assert.equal(elements.get('update-all').disabled,true);
  assert.equal(elements.get('update-page').disabled,true);
  assert.match(elements.get('update-last').textContent,/尚未接通 Grok/);
  assert.match(elements.get('update-error').textContent,/尚未接通/);
  assert.equal(elements.get('update-login').hidden,true);
});

test('unconnected history removal preserves login and live progress',async()=>{
  const loggedOut=await boot(401,{error:'登录后可更新内容'});
  assert.equal(loggedOut.elements.get('update-page').disabled,false);
  assert.equal(loggedOut.elements.get('update-login').hidden,false);
  await loggedOut.elements.get('update-page').onclick();
  assert.equal(loggedOut.elements.get('update-key').focused,true);
  const {elements}=await boot(200,{authenticated:true,online:true,jobs:[{id:'test-job',page:'news',attempt:1,status:'running',stage:'collecting',message:'正在执行本次检索'}]});
  assert.equal(elements.get('update-login').hidden,true);
  assert.equal(elements.get('update-page').disabled,true);
  assert.match(elements.get('update-last').textContent,/正在采集/);
  assert.equal(elements.get('update-connection').textContent,'正在执行本次检索');
});
