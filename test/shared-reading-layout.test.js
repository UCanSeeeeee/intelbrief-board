const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('all active pages ship the shared reading layer without restoring paused pages', () => {
  for (const page of ['index', 'people', 'tickers', 'ai', 'learning', 'macro', 'earnings']) {
    const html = read(page + '.html');
    assert.ok(html.indexOf('styles.css') < html.indexOf('reading.css'), page);
    assert.match(html, /href="reading\.css"/);
  }
  assert.match(read('scripts/build-site.js'), /'reading\.css'/);
  assert.doesNotMatch(read('scripts/build-site.js'), /'crypto\.html'|'shorts\.html'/);
});

test('people ticker and AI cards expose complete facts and judgments after metadata', () => {
  for (const file of ['people.js', 'tickers.js', 'ai.js']) {
    const source = read(file);
    for (const marker of ['signal-meta', 'signal-author', 'signal-verification', 'signal-copy', 'signal-impact', 'signal-scope']) assert.ok(source.includes(marker), file + ': ' + marker);
    assert.ok(source.includes('escape(item.fact'), file);
    assert.ok(source.includes('escape(item.whyItMatters'), file);
    assert.ok(source.includes('affected.map(escape)'), file);
  }
});

test('learning and calendars retain their task-specific full-content structure', () => {
  const learning = read('learning.js');
  for (const marker of ['professional-version', 'story-version', 'story.mapping', 'story.boundary', 'paper-detail-grid', 'knowledge-detail-grid']) assert.ok(learning.includes(marker), marker);
  assert.match(read('earnings.js'), /IntelCalendar\.earningsState/);
  assert.match(read('macro.js'), /IntelCalendar\.macroTime/);
  const css = read('reading.css');
  assert.match(css, /position: sticky/);
  assert.match(css, /max-width: 768px/);
  assert.doesNotMatch(css, /line-clamp|text-overflow|overflow:\s*hidden|white-space:\s*nowrap/);
});
