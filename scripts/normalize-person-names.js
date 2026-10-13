#!/usr/bin/env node
// One-off/idempotent migration: Chinese transliterated person names -> original
// names in card text, and attach registry intros as `people` on each card.
// Original quotes (excerpt/text) and recorded search queries stay untouched.
const fs=require('node:fs');
const path=require('node:path');
const {loadRegistry,migrateTree,mentionedPeople}=require('./lib/person-names');
const root=path.resolve(__dirname,'..');
const reg=loadRegistry();
const files=['data/reading-board.json','data/people-intelligence.json','data/ticker-intelligence.json','data/ai-intelligence.json','data/crypto-intelligence.json',...fs.readdirSync(path.join(root,'data/stock-briefs')).filter(f=>f.endsWith('.json')&&f!=='index.json').map(f=>'data/stock-briefs/'+f)];
const isCard=o=>o&&typeof o==='object'&&!Array.isArray(o)&&typeof o.title==='string'&&typeof o.fact==='string'&&(Array.isArray(o.sources)||typeof o.url==='string');
function attach(node){
  if(Array.isArray(node)){node.forEach(attach);return;}
  if(!node||typeof node!=='object')return;
  for(const v of Object.values(node))attach(v);
  if(isCard(node))node.people=mentionedPeople(node,reg);
}
let changed=0;
for(const rel of files){
  const file=path.join(root,rel);if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8');
  const data=migrateTree(JSON.parse(before),reg);attach(data);
  const indent=/^\{\n( +)/.exec(before)?.[1]?.length||2;
  const after=JSON.stringify(data,null,indent)+(before.endsWith('\n')?'\n':'');
  if(after!==before){fs.writeFileSync(file,after);changed++;console.log('updated',rel);}
}
console.log(`person-name migration: ${changed} file(s) changed`);
