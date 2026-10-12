// Product reading periods use Beijing batches, not US exchange sessions.
const DAY=86400000;
const POLICY='beijing-batches-v1';
function day(value) {
  const at=new Date(value);
  if(!Number.isFinite(at.getTime()))throw new Error('无效截止时间');
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
function context(value) {
  const date=day(value),w=weekday(date);
  const readingDate=shift(date,w===6?2:w===0?1:0);
  let next=shift(readingDate,1);
  while([0,6].includes(weekday(next)))next=shift(next,1);
  return {policy:POLICY,timezone:'Asia/Shanghai',date:readingDate,weekendCarry:[0,6].includes(w),retainUntil:new Date(next+'T09:00:00+08:00').toISOString()};
}
function readingWindow(cutoff) {
  const end=new Date(cutoff).getTime(),date=day(cutoff);
  const weekend=weekday(date)===1?Date.parse(shift(date,-2)+'T00:00:00+08:00'):end-DAY;
  return {start:new Date(Math.min(end-DAY,weekend)).toISOString(),end:new Date(end).toISOString(),period:context(cutoff)};
}
module.exports={POLICY,context,readingWindow};
