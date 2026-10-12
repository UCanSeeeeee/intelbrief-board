const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('CSS has no text truncation', () => {
  const css = read('styles.css');
  assert.doesNotMatch(css, /text-overflow\s*:\s*ellipsis/);
  assert.doesNotMatch(css, /line-clamp/);
  assert.doesNotMatch(css, /-webkit-box/);
  assert.doesNotMatch(css, /overflow\s*:\s*hidden/);
  assert.doesNotMatch(css, /white-space\s*:\s*nowrap/);
});

test('front-end JS does not truncate display strings', () => {
  for (const f of ['app.js','briefs.js','people.js','tickers.js','ai.js','crypto.js','earnings.js','updates.js']) {
    const js = read(f);
    for (const m of js.matchAll(/\.(slice|substring|substr)\(([^)]*)\)/g)) {
      // Only item-count limits (rules) are allowed: .slice(0, tab.latestLimit / tab.weeklyLimit)
      assert.match(m[2], /^0,\s*tab\.(latestLimit|weeklyLimit)$/, `${f}: ${m[0]}`);
    }
    // Progress text like 「正在更新…」 is fine; an ellipsis glued to a cut string is not.
    assert.doesNotMatch(js, /\.(slice|substring|substr)\([^)]*\)\s*\+\s*['"`](…|\.\.\.)/, `${f} truncates with ellipsis`);
  }
});
