#!/usr/bin/env node
const { readJson, sourceIndex } = require('./lib/x-data');
const { slotAt, prepareBrief, saveBrief } = require('./lib/stock-brief');
try {
  const [command, inputFile] = process.argv.slice(2);
  if (command === 'slot') console.log(JSON.stringify(slotAt(), null, 2));
  else if (command === 'context') {
    const {readingWindow}=require('./lib/trading-session');
    const {readBoard}=require('./lib/reading-board');
    const {ROOT}=require('./lib/x-data');
    const path=require('node:path');
    const {windowStart,readCoverage,uncoveredRanges}=require('./lib/windows');
    const cutoff=inputFile||slotAt().previous.scheduledFor;
    const editions=readJson(path.join(ROOT,'data/stock-briefs/index.json')).editions;
    const searchWindowStart=windowStart(editions,{cutoff,trigger_type:'scheduled'});
    console.log(JSON.stringify({cutoff,...readingWindow(cutoff),searchWindowStart,uncovered:uncoveredRanges(readCoverage(ROOT),'news',searchWindowStart,cutoff),readingBoard:readBoard(ROOT)},null,2));
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
