const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('news pilot stylesheet is isolated from other sidebar pages and deployed explicitly', () => {
  assert.match(read('index.html'), /href="news\.css"/);
  for (const file of ['people.html', 'tickers.html', 'ai.html', 'learning.html', 'macro.html', 'earnings.html']) {
    assert.doesNotMatch(read(file), /href="news\.css"/, file);
  }
  assert.match(read('scripts/build-site.js'), /'news\.css'/);
  const css = read('news.css');
  assert.doesNotMatch(css, /line-clamp|text-overflow|overflow:\s*hidden/);
  assert.match(css, /body\[data-page="news"\] \.brief-copy/);
  assert.match(css, /@media \(max-width: 768px\)/);
});

test('news cards retain author, verification, full fact and impact, scope and event time', () => {
  const source = read('briefs.js');
  for (const marker of ['brief-author', 'brief-published', 'signal-verification', 'brief-change', 'brief-fact', 'brief-impact', 'brief-scope', '事件时间', '原文链接']) assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /class="brief-rank"/);
  assert.ok(source.includes('escape(event.fact)'));
  assert.ok(source.includes('escape(event.impact)'));
  assert.ok(source.includes('escape(event.horizon)'));
  assert.ok(source.includes('event.affected.map(escape)'));
});
