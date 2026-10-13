const test=require('node:test');
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const names=require('../scripts/lib/person-names');
const root=path.join(__dirname,'..');

test('registry: original-form names, intros 1-15 chars, unique', ()=>{
  const reg=names.loadRegistry();
  assert.ok(reg.people.length>=10);
  for(const p of reg.people){
    assert.doesNotMatch(p.name,/[\u3400-\u9fff]/,p.name);
    assert.ok([...p.intro].length>=1&&[...p.intro].length<=15,`${p.name} intro too long`);
  }
});

test('transliterations are replaced with spacing; quotes and queries are preserved', ()=>{
  assert.strictEqual(names.replaceAliases('乌克兰总统泽连斯基表示，遵守特朗普宣布的'),'乌克兰总统 Volodymyr Zelensky 表示，遵守 Donald Trump 宣布的');
  assert.strictEqual(names.replaceAliases('埃隆·马斯克发帖称'),'Elon Musk 发帖称');
  assert.strictEqual(names.replaceAliases('纳德拉：Maia'),'Satya Nadella：Maia');
  const tree=names.migrateTree({title:'黄仁勋回顾',sources:[{excerpt:'黄仁勋 said'}],coverage:{queries:['黄仁勋 Maia']}});
  assert.strictEqual(tree.title,'Jensen Huang 回顾');
  assert.strictEqual(tree.sources[0].excerpt,'黄仁勋 said');
  assert.strictEqual(tree.coverage.queries[0],'黄仁勋 Maia');
});

test('annotateCard fails on transliteration and lists mentioned people from text and handles', ()=>{
  assert.throws(()=>names.annotateCard({title:'马斯克称',fact:'x'}),/中文音译/);
  const card=names.annotateCard({title:'Satya Nadella：Maia',fact:'@TrumpDailyPosts 转述',author:'elonmusk'});
  assert.deepStrictEqual(card.people.map(p=>p.name),['Satya Nadella','Elon Musk']);
  assert.ok(card.people.every(p=>p.intro));
});

test('published cards carry no transliterated names and render person intros', ()=>{
  for(const rel of ['data/reading-board.json','data/people-intelligence.json']){
    const text=fs.readFileSync(path.join(root,rel),'utf8');
    for(const a of ['纳德拉','黄仁勋','马斯克','泽连斯基']) assert.doesNotMatch(JSON.parse(text).items?JSON.stringify(JSON.parse(text).items.map(i=>[i.title,i.fact])):JSON.stringify(JSON.parse(text).events.map(e=>[e.event.title,e.event.fact])),new RegExp(a),`${rel} ${a}`);
  }
  for(const f of ['briefs.js','people.js','tickers.js','ai.js','crypto.js']){
    const js=fs.readFileSync(path.join(root,f),'utf8');
    assert.match(js,/peopleNote\((event|item)\.people\)/,f);
    assert.match(js,/person-chip-intro/,f);
  }
  assert.match(fs.readFileSync(path.join(root,'styles.css'),'utf8'),/\.card-people/);
});
