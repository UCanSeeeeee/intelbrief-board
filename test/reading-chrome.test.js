const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('active reading surfaces do not restore generic policies or count banners',()=>{
  const files=['index.html','people.html','tickers.html','ai.html','learning.html','earnings.html','macro.html','people.js','tickers.js','ai.js','sentiment.js'];
  for(const file of files){const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert.doesNotMatch(source,/关注范围与收录规则|已入选事件|休市期间显示最近公布值|情绪指标不代表涨跌概率|按影响范围、时效与预期差比较|启动整理/,file);}
  const config=require('../config/learning.json');assert.deepEqual(config.tabs.map(t=>t.id),['basics','nature','science','counterintuitive']);assert.equal(config.journalPolicy.dailyLimitPerJournal,3);
});
