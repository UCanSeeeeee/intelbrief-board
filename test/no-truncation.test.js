const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('all reading disclosures start open and cards omit counter-condition sections', () => {
  const root=path.join(__dirname,'..');
  const frontend=fs.readdirSync(root).filter(f=>/\.(?:html|js)$/.test(f));
  let disclosures=0;
  for(const file of frontend){
    const source=read(file);
    for(const match of source.matchAll(/<details\b[^>]*>/g)){
      disclosures++;
      assert.match(match[0],/\sopen(?:\s|>|=)/,`${file}: reading disclosure starts collapsed`);
    }
    assert.doesNotMatch(source,/反向条件|event\.counterCase|item\.counterCase/,`${file}: counter-condition UI was restored`);
  }
  assert.ok(disclosures>=10,'covers reading rules, cards, audit, company and scoring disclosures');
});

test('CSS has no text truncation', () => {
  for (const file of ['styles.css', 'reading.css', 'news.css']) {
  const css = read(file);
  assert.doesNotMatch(css, /text-overflow\s*:\s*ellipsis/);
  assert.doesNotMatch(css, /line-clamp/);
  assert.doesNotMatch(css, /-webkit-box/);
  assert.doesNotMatch(css, /overflow\s*:\s*hidden/);
  assert.doesNotMatch(css, /white-space\s*:\s*nowrap/);
  }
});

test('front-end JS does not truncate display strings', () => {
  for (const f of ['app.js','briefs.js','people.js','tickers.js','ai.js','learning.js','crypto.js','earnings.js']) {
    const js = read(f);
    for (const m of js.matchAll(/\.(slice|substring|substr)\(([^)]*)\)/g)) {
      // Only item-count limits (rules) are allowed: .slice(0, tab.latestLimit / tab.weeklyLimit)
      assert.match(m[2], /^0,\s*tab\.(latestLimit|weeklyLimit)$/, `${f}: ${m[0]}`);
    }
    // Progress text like 「正在更新…」 is fine; an ellipsis glued to a cut string is not.
    assert.doesNotMatch(js, /\.(slice|substring|substr)\([^)]*\)\s*\+\s*['"`](…|\.\.\.)/, `${f} truncates with ellipsis`);
  }
});
