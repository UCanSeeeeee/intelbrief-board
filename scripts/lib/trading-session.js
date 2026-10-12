// Calendar evidence is explicit and bounded. Never infer holidays from federal/bank calendars.
const {fromNewYork}=require('../../calendar-time');
const calendar=require('../../config/us-market-calendar.json');
const DAY=86400000;
function dateInNY(value) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function shift(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*DAY).toISOString().slice(0,10);}
function session(date,cfg=calendar) {
  if(date<cfg.validFrom||date>cfg.validThrough) throw new Error('交易日历超出已核验范围');
  const override=cfg.overrides?.[date];
  if(override&&(!/^https:\/\/(?:www\.nyse\.com|ir\.theice\.com)\//.test(override.source||'')||!override.reason)) throw new Error('临时日历调整缺少官方来源或原因');
  if(override?.closed) return null;
  if(!override?.open && ([0,6].includes(new Date(date+'T12:00:00Z').getUTCDay())||cfg.holidays.includes(date))) return null;
  const open=fromNewYork(date,override?.open||cfg.open);
  const close=fromNewYork(date,override?.close||cfg.earlyCloses[date]||cfg.close);
  if(!open||!close||close<=open) throw new Error('交易时段无效');
  return {date,openAt:open.toISOString(),closeAt:close.toISOString(),earlyClose:(override?.close||cfg.earlyCloses[date]||cfg.close)!==cfg.close};
}
function context(value,cfg=calendar) {
  const at=Date.parse(value);if(!Number.isFinite(at))throw new Error('无效截止时间');
  try {
    const date=dateInNY(at);let target=null,previous=null;
    for(let i=0;i<370;i++){const s=session(shift(date,i),cfg);if(s&&Date.parse(s.closeAt)>at){target=s;break;}}
    if(!target)throw new Error('未找到下一交易日');
    for(let i=1;i<370;i++){const s=session(shift(target.date,-i),cfg);if(s){previous=s;break;}}
    if(!previous)throw new Error('未找到前一交易日');
    return {known:true,...target,previousCloseAt:previous.closeAt,phase:at<Date.parse(target.openAt)?'before-open':'regular',source:cfg.source};
  } catch(error) {return {known:false,warning:error.message,source:cfg.source};}
}
function readingWindow(cutoff,cfg=calendar) {
  const c=context(cutoff,cfg),end=Date.parse(cutoff);
  return {start:new Date(Math.min(end-DAY,c.known?Date.parse(c.previousCloseAt):end-14*DAY)).toISOString(),end:new Date(end).toISOString(),session:c};
}
module.exports={calendar,session,context,readingWindow};
