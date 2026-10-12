// Display window vs search window. All Beijing-time math goes through Intl, never "+8h string slicing".
const fs=require('node:fs');
const path=require('node:path');
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
  const end=Date.parse(cutoff);
  const weekend=weekendStart(cutoff);
  const start=Math.min(end-DAY,weekend??Infinity);
  return {displayWindowStart:beijingIso(start),displayWindowEnd:beijingIso(end)};
}
// Search starts at the last successful scheduled cutoff, bounded to 24h, but Monday always includes Sat/Sun.
function windowStart(editions,job) {
  // Manual editions never move the scheduled collection cursor.
  const cutoff=Date.parse(job.cutoff);
  const candidates=editions.filter(e=>e.status!=='failed' && Date.parse(e.scheduledFor)<cutoff && (job.trigger_type!=='scheduled'||e.trigger!=='manual'));
  const previous=candidates.sort((a,b)=>Date.parse(b.scheduledFor)-Date.parse(a.scheduledFor))[0];
  let start=Math.max(previous?Date.parse(previous.scheduledFor):0,cutoff-DAY);
  const weekend=weekendStart(job.cutoff);
  if(weekend!=null) start=Math.min(start,weekend);
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
  for(const r of coverage.records.filter(r=>r.page===page)) {
    const a=Date.parse(r.start),b=Date.parse(r.end);
    gaps=gaps.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[[s,Math.max(s,a)],[Math.min(e,b),e]].filter(([x,y])=>y>x));
  }
  return gaps.map(([s,e])=>({start:beijingIso(s),end:beijingIso(e)}));
}
module.exports={beijingIso,beijingWeekday,weekendStart,displayWindow,windowStart,readCoverage,recordCoverage,uncoveredRanges,coveragePath};
