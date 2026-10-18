#!/usr/bin/env node
// Refresh a small public fallback snapshot; not a website build or X collection.
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { fetchSentiment, validSnapshot } = await import('../market-sentiment.mjs');
  const file = path.join(__dirname, '../data/market-sentiment.json');
  let previous = null;
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (validSnapshot(value)) previous = value; } catch { /* first collection */ }
  try {
    const latest = await fetchSentiment();
    if (previous && Date.parse(latest.timestamp) < Date.parse(previous.timestamp)) throw new Error('来源时间回退，保留较新存档');
    fs.writeFileSync(file, JSON.stringify(latest, null, 2) + '\n');
    console.log(`CNN恐惧与贪婪 ${latest.score.toFixed(1)}；数据时间 ${latest.timestamp}；${latest.source.method === 'cnn' ? 'CNN直连' : '公开镜像'}。`);
  } catch (error) {
    console.error(`${error.message}；${previous ? '已有快照未修改，网页将显示原始时间' : '无可用快照，网页明确显示暂不可用'}。`);
    process.exitCode = 1;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
