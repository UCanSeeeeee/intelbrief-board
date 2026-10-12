const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync,execFileSync} = require('node:child_process');
const {entry,ROUTES} = require('../scripts/agent-entry');
const root=path.resolve(__dirname,'..');

test('every allowed agent route resolves real project context',()=>{
  for(const task of Object.keys(ROUTES)){
    const role=task==='code'?'gpt':'grok';
    const result=entry(role,task);
    assert.deepEqual(result.files.slice(0,3),['AGENTS.md','CONTEXT.md','TASKS.md']);
    for(const file of result.files) assert.ok(fs.statSync(path.join(root,file)).isFile());
  }
  assert.ok(entry('grok','news').files.includes('knowledge/GROK_X_COLLECTION_SOP.md'));
});

test('entry rejects wrong execution role and unknown tasks',()=>{
  assert.throws(()=>entry('gpt','news'),/内容执行只由 Grok/);
  assert.throws(()=>entry('grok','code'),/代码功能维护交给GPT/);
  assert.throws(()=>entry('unknown','status'),/必须明确角色/);
  assert.throws(()=>entry('gpt','unknown'),/未知任务/);
});

test('entry CLI reports routes without changing git state',()=>{
  const status=()=>execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});
  const before=status();
  const result=spawnSync(process.execPath,['scripts/agent-entry.js','--role','gpt','--task','code'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/未联网、未修改/);
  assert.match(result.stdout,/OPS-01/);
  assert.equal(status(),before);
});

test('agent instructions fit discovery budget and preserve synchronization rules',()=>{
  const instructions=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
  assert.ok(Buffer.byteLength(instructions)<32768);
  assert.match(instructions,/git pull --ff-only origin master/);
  assert.match(instructions,/git push origin HEAD:master/);
  assert.match(instructions,/不得定时采集/);
  for(const file of ['AGENTS.md','TASKS.md','docs/AGENT_ENTRY.md','docs/GROK_BOT_OPERATIONS.md']){
    const content=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of content.matchAll(/\]\(([^)]+)\)/g)){
      const link=match[1];if(/^(https?:|#)/.test(link))continue;
      assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),link.split('#')[0])),file+': '+link);
    }
  }
});
