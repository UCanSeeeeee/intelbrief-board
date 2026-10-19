#!/usr/bin/env node
// Publish accepted paper summaries only; does not search, invent, or launch tasks.
const fs=require('node:fs'),path=require('node:path');
const {validateJournalLearning}=require('./lib/journal-learning');
try {
  if(!process.argv[2])throw new Error('用法：node scripts/publish-journal-learning.js <本轮论文载荷.json>');
  const root=path.resolve(__dirname,'..'),file=path.join(root,'data/journal-learning.json');
  const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  if(input.notForPublication)throw new Error('本载荷为未入选候选，不得发布');
  const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,reviews:[],coverage:{}};
  if(!Array.isArray(input.reviews))throw new Error('缺少本轮reviews；失败时使用空数组并写coverage');
  for(const p of input.reviews)if(old.reviews.some(o=>o.id===p.id||o.doi.toLowerCase()===p.doi.toLowerCase()))throw new Error('禁止覆盖既有选读或重复DOI；同日可补至3篇，更正需保留依据单独处理');
  const data={schemaVersion:1,updatedAt:new Date().toISOString(),reviews:[...old.reviews,...input.reviews],coverage:{...old.coverage,...input.coverage}};
  const result=validateJournalLearning(JSON.parse(fs.readFileSync(path.join(root,'config/learning.json'),'utf8')),data);
  if(result.errors.length)throw new Error(result.errors.join('；'));
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);
  console.log(`已保存${input.reviews.length}篇新选读，完整保留${old.reviews.length}篇往期；两刊来源状态独立。`);
}catch(error){console.error(error.message);process.exitCode=1;}
