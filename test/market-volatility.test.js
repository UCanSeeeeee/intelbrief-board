const test=require('node:test'),assert=require('node:assert/strict');
test('VIX boundaries follow the user image rather than trading recommendations',async()=>{
  const {vixBand}=await import('../market-volatility.mjs');
  for(const [value,id] of [[19.99,'low'],[20,'elevated'],[29.99,'elevated'],[30,'fear'],[40,'fear'],[40.01,'extreme']])assert.equal(vixBand(value).id,id);
  for(const value of [0,-1,NaN,Infinity,'20'])assert.throws(()=>vixBand(value));
});
test('Cboe CSV preserves the source date and close, rejecting a future date',async()=>{
  const {normalizeVix,validVix}=await import('../market-volatility.mjs');
  const csv='DATE,OPEN,HIGH,LOW,CLOSE\n10/15/2026,17,18,16,16.46\n10/16/2026,16,23,15,19.99\n';
  const now=new Date('2026-10-19T12:00:00+08:00'),data=normalizeVix(csv,now);
  assert.equal(data.value,19.99);assert.equal(data.previousClose,16.46);assert.equal(data.asOfDate,'2026-10-16');assert.equal(data.quoteKind,'close');
  assert.ok(validVix(data,now));assert.equal(validVix({...data,asOfDate:'2027-01-01'},now),false);
});
