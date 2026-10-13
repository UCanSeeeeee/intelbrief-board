// Person names stay in their original form; each card lists mentioned people
// with a registry intro (≤15 chars). User rule 2026-10-13.
const fs=require('node:fs');
const path=require('node:path');
const REGISTRY=path.join(__dirname,'..','..','config','person-registry.json');
// Card text the reader sees. Original quotes (sources[].excerpt, raw post text)
// and recorded search queries are evidence and are never rewritten.
const CARD_FIELDS=['title','fact','impact','whyItMatters','counterCase','selectionReason','credibilityReason','eventTimeNote','attentionEvidence','continuationReason','futureEventNote','contextSourceNote','knowledgeApplication'];
const PRESERVE_KEYS=new Set(['excerpt','text','queries','url','username','author','postId','eventKey']);
let cached;
function loadRegistry(file=REGISTRY){
  if(file===REGISTRY&&cached)return cached;
  const reg=JSON.parse(fs.readFileSync(file,'utf8'));
  const max=reg.introMaxChars||15;
  const seen=new Set();
  for(const p of reg.people){
    if(!p.name||/[\u3400-\u9fff]/.test(p.name)&&p.originalScript!=='han')throw new Error(`人物登记 ${p.name}：name 必须为原文写法`);
    if(seen.has(p.name))throw new Error(`人物登记重复：${p.name}`);seen.add(p.name);
    if(typeof p.intro!=='string'||!p.intro.trim()||[...p.intro].length>max)throw new Error(`人物登记 ${p.name}：简介需 1–${max} 字（当前 ${[...(p.intro||'')].length}）`);
    if(!Array.isArray(p.aliases)||!Array.isArray(p.matchTerms))throw new Error(`人物登记 ${p.name}：缺少 aliases/matchTerms`);
  }
  const aliases=reg.people.flatMap(p=>p.aliases.map(a=>({alias:a,person:p}))).sort((a,b)=>b.alias.length-a.alias.length);
  const out={...reg,aliases};
  if(file===REGISTRY)cached=out;
  return out;
}
const tight=/[\p{Script=Han}A-Za-z0-9]/u;
function replaceAliases(text,reg=loadRegistry()){
  if(typeof text!=='string')return text;
  let out=text;
  for(const {alias,person} of reg.aliases){
    let idx;
    while((idx=out.indexOf(alias))!==-1){
      const before=out[idx-1]||'',after=out[idx+alias.length]||'';
      out=out.slice(0,idx)+(tight.test(before)?' ':'')+person.name+(tight.test(after)?' ':'')+out.slice(idx+alias.length);
    }
  }
  return out;
}
function findAliases(text,reg=loadRegistry()){
  if(typeof text!=='string')return [];
  return reg.aliases.filter(a=>text.includes(a.alias)).map(a=>a.alias);
}
function escapeRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function mentionedPeople(card,reg=loadRegistry()){
  const text=CARD_FIELDS.map(k=>card[k]).filter(v=>typeof v==='string').join('\n');
  const handles=[card.author,...(card.sources||[]).map(s=>s.username)].filter(Boolean).map(h=>String(h).replace(/^@/,'').toLowerCase());
  return reg.people.filter(p=>p.matchTerms.some(t=>new RegExp(`(?<![A-Za-z])${escapeRe(t)}(?![A-Za-z])`).test(text))||(p.handles||[]).some(h=>handles.includes(h.toLowerCase())||new RegExp(`@${escapeRe(h)}(?![A-Za-z0-9_])`,'i').test(text)))
    .map(p=>({name:p.name,intro:p.intro}));
}
// Throws when a card still uses a Chinese transliteration in a name position;
// returns the card with a registry-derived people list.
function annotateCard(card,reg=loadRegistry(),where='卡片'){
  for(const k of CARD_FIELDS){
    const hit=findAliases(card[k],reg);
    if(hit.length)throw new Error(`${where}.${k} 使用了人名中文音译：${hit.join('、')}；请改为原文写法（见 config/person-registry.json）`);
  }
  if(card.credibility&&findAliases(card.credibility.reason,reg).length)throw new Error(`${where}.credibility.reason 使用了人名中文音译`);
  card.people=mentionedPeople(card,reg);
  return card;
}
function samePeople(a=[],b=[]){return JSON.stringify(a)===JSON.stringify(b);}
// Rewrites every display string in a data tree, leaving quotes/queries intact.
function migrateTree(node,reg=loadRegistry(),key=''){
  if(PRESERVE_KEYS.has(key))return node;
  if(typeof node==='string')return replaceAliases(node,reg);
  if(Array.isArray(node))return node.map(v=>migrateTree(v,reg,''));
  if(node&&typeof node==='object'){for(const k of Object.keys(node))node[k]=migrateTree(node[k],reg,k);}
  return node;
}
module.exports={REGISTRY,CARD_FIELDS,loadRegistry,replaceAliases,findAliases,mentionedPeople,annotateCard,samePeople,migrateTree};
