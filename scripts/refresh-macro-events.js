#!/usr/bin/env node
/** Low-frequency helper: validate macro-events.json structure and print counts. Does not invent dates. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/macro-events.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config/macro-events.json'), 'utf8'));
if (!Array.isArray(data.quarters) || data.quarters.length !== 4) {
  console.error('Need exactly 4 quarters');
  process.exit(1);
}
let n = 0;
for (const q of data.quarters) {
  for (const e of q.events || []) {
    n++;
    if (!e.id || !e.date || !e.title || !e.category || !Array.isArray(e.sources) || !e.sources.length) {
      console.error('Invalid event', e.id || e);
      process.exit(1);
    }
  }
}
console.log(`[macro] year=${data.year} events=${n} byQuarter=${JSON.stringify(data.counts?.byQuarter)}`);
console.log(`[macro] refresh mode=${cfg.refresh?.mode}; not tied to brief slots.`);
console.log('[macro] To update: edit data/macro-events.json with official dates only, then npm run check && git commit && git push.');
