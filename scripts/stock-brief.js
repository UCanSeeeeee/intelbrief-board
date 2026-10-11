#!/usr/bin/env node
const { readJson, sourceIndex } = require('./lib/x-data');
const { slotAt, prepareBrief, saveBrief } = require('./lib/stock-brief');
try {
  const [command, inputFile] = process.argv.slice(2);
  if (command === 'slot') console.log(JSON.stringify(slotAt(), null, 2));
  else if (['validate', 'publish'].includes(command) && inputFile) {
    const brief = prepareBrief(readJson(inputFile), { sources: sourceIndex() });
    if (command === 'publish') console.log(saveBrief(brief));
    else console.log(`Validated ${brief.id}: ${brief.counts.focus}+${brief.counts.insights}`);
  } else throw new Error('Usage: node scripts/stock-brief.js slot | validate FILE | publish FILE');
} catch (error) { console.error(error.message); process.exitCode = 1; }
