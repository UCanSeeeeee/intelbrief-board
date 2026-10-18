#!/usr/bin/env node
const fs=require('node:fs');
const p=require('./lib/collection-progress');
try{
  const [command,value,page]=process.argv.slice(2);
  if(command==='plan')console.log(JSON.stringify({cutoff:value,units:p.plan(p.ROOT,value,page)},null,2));
  else if(command==='record'){const input=JSON.parse(fs.readFileSync(value,'utf8'));const state=p.apply(p.ROOT,input);p.write(p.ROOT,state);console.log('已保存各对象采集进度；与卡片条数、Git发布进度独立。');}
  else if(command==='init'){p.write(p.ROOT,p.initialize(p.ROOT,value));console.log('已从既有执行审计建立增量切换点，未重新采集或改写新闻。');}
  else throw new Error('用法：collection-progress.js plan CUTOFF [news|people|tickers|ai] | record RESULT.json | init AUDIT.json');
}catch(error){console.error(error.message);process.exitCode=1;}
