// Display window vs search window. All Beijing-time math goes through Intl, never "+8h string slicing".
const fs=require('node:fs');
const path=require('node:path');
const {readingWindow}=require('./reading-period');
const TZ='Asia/Shanghai';
const DAY=86400000;
function parts(ms) {
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'});
  return Object.fromEntries(fmt.formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
}
function beijingIso(value) {
  const ms=typeof value==='number'?value:Date.parse(value);
  if(!Number.isFinite(ms)) throw new Error('无效时间');
  const p=parts(ms);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`;
}
function beijingWeekday(value) { return parts(Date.parse(value)).weekday; }
// Monday (Beijing) cutoffs must reach back over the whole weekend: previous Saturday 00:00 Beijing.
function weekendStart(cutoff) {
  const ms=Date.parse(cutoff);
  if(beijingWeekday(cutoff)!=='Mon') return null;
  const p=parts(ms);
  return Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00+08:00`)-2*DAY;
}
function displayWindow(cutoff) {
  const window=readingWindow(cutoff);
  return {displayWindowStart:beijingIso(window.start),displayWindowEnd:beijingIso(window.end)};
}
// Search covers Beijing reading batches and up to fourteen days of missed runs.
function windowStart(editions,job) {
  // Manual editions never move the scheduled collection cursor.
  const cutoff=Date.parse(job.cutoff);
  const candidates=editions.filter(e=>e.status!=='failed' && Date.parse(e.scheduledFor)<cutoff && (job.trigger_type!=='scheduled'||e.trigger!=='manual'));
  const previous=candidates.sort((a,b)=>Date.parse(b.scheduledFor)-Date.parse(a.scheduledFor))[0];
  // The display/closed-market interval must not disappear merely because a brief
  // was partial. Only explicit successful coverage records may skip a query range.
  let start=Date.parse(displayWindow(job.cutoff).displayWindowStart);
  if(previous) start=Math.min(start,Math.max(Date.parse(previous.scheduledFor),cutoff-14*DAY));
  return new Date(start).toISOString();
}
// Local record of searched time ranges x queries, used to avoid re-searching covered spans.
function coveragePath(root) { return path.join(root,'data/search-coverage.json'); }
function readCoverage(root) {
  const file=coveragePath(root);
  return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,records:[]};
}
function recordCoverage(coverage,record,keepDays=14,now=Date.now()) {
  for(const k of ['jobId','page','start','end']) if(!record[k]) throw new Error(`检索记录缺少${k}`);
  if(!(Date.parse(record.start)<Date.parse(record.end))) throw new Error('检索记录区间无效');
  const records=coverage.records.filter(r=>r.jobId!==record.jobId&&Date.parse(r.end)>=now-keepDays*DAY);
  records.push({...record,queries:(record.queries||[]).map(String)});
  records.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  return {schemaVersion:1,records};
}
// Returns sub-ranges of [start,end) not yet covered by any record for this page.
function uncoveredRanges(coverage,page,start,end) {
  let gaps=[[Date.parse(start),Date.parse(end)]];
  // Legacy records without an explicit success marker do not prove coverage.
  for(const r of coverage.records.filter(r=>r.page===page&&r.status==='complete'&&r.trigger!=='manual')) {
    const a=Date.parse(r.start),b=Date.parse(r.end);
    gaps=gaps.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[[s,Math.max(s,a)],[Math.min(e,b),e]].filter(([x,y])=>y>x));
  }
  return gaps.map(([s,e])=>({start:beijingIso(s),end:beijingIso(e)}));
}
module.exports={beijingIso,beijingWeekday,weekendStart,displayWindow,windowStart,readCoverage,recordCoverage,uncoveredRanges,coveragePath};
