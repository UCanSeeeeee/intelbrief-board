#!/usr/bin/env node
const { readJson, sourceIndex } = require('./lib/x-data');
const { slotAt, prepareBrief, saveBrief } = require('./lib/stock-brief');
try {
  const [command, inputFile] = process.argv.slice(2);
  if (command === 'slot') console.log(JSON.stringify(slotAt(), null, 2));
  else if (command === 'context') {
    const {readingWindow}=require('./lib/reading-period');
    const {readBoard}=require('./lib/reading-board');
    const {ROOT}=require('./lib/x-data');
    const path=require('node:path');
    const {beijingIso,windowStart,readCoverage,uncoveredRanges}=require('./lib/windows');
    const cutoff=inputFile||beijingIso(Date.now());
    const editions=readJson(path.join(ROOT,'data/stock-briefs/index.json')).editions;
    const collectionUnits=require('./lib/collection-progress').plan(ROOT,cutoff,'news');
    const searchWindowStart=windowStart(editions,{cutoff,collectionUnits});
    console.log(JSON.stringify({cutoff,...readingWindow(cutoff),searchWindowStart,collectionUnits,uncovered:collectionUnits.filter(u=>u.needsQuery).map(u=>({unit:u.id,start:u.start,end:u.end})),readingBoard:readBoard(ROOT)},null,2));
  }
  else if (['validate', 'publish'].includes(command) && inputFile) {
    const brief = prepareBrief(readJson(inputFile), { sources: sourceIndex() });
    if (command === 'publish') console.log(saveBrief(brief));
    else {
      const {readBoard,advance}=require('./lib/reading-board');
      advance(readBoard(require('./lib/x-data').ROOT),brief);
      console.log(`Validated ${brief.id}: ${brief.counts.focus}+${brief.counts.insights}`);
    }
  } else throw new Error('Usage: node scripts/stock-brief.js slot | context [CUTOFF] | validate FILE | publish FILE');
} catch (error) { console.error(error.message); process.exitCode = 1; }
