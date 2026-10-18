const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const p=require('../scripts/lib/collection-progress');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'intelbrief-progress-'));
  fs.mkdirSync(path.join(root,'config'));fs.mkdirSync(path.join(root,'data/collection-runs'),{recursive:true});
  for(const [file,id]of [['people','elon-musk'],['ticker','mu'],['ai','openai']])fs.writeFileSync(path.join(root,'config',file+'-intelligence.json'),JSON.stringify({tabs:[{id,label:id}]}));
  return root;
}
function report(root,status='searched',runId='manual-fixture',unit='tickers:mu',start='2026-10-18T19:43:00+08:00',end='2026-10-18T20:30:00+08:00'){
  const result={unit,start,end,status,queries:status==='failed'?[]:['synthetic public query'],note:'测试夹具，不是实际采集',evidenceFile:'data/collection-runs/'+runId+'.json'};
  fs.writeFileSync(path.join(root,result.evidenceFile),JSON.stringify({id:runId,cutoff:end,collectionResults:[result],batches:[{page:unit.split(':')[0],output:{items:[],focus:[],insights:[]}}]}));
  return {runId,cutoff:end,results:[result]};
}
const now=new Date('2026-10-19T01:00:00Z');
test('手动成功截止参与下次定时增量；无入选也推进；重复回执幂等',()=>{
  const root=fixture();try{
    const input=report(root,'no-result');p.write(root,p.apply(root,input,now));
    const next=p.plan(root,'2026-10-19T08:00:00+08:00','tickers')[0];
    assert.equal(next.start,'2026-10-18T12:30:00.000Z');
    assert.equal(next.end,'2026-10-19T00:00:00.000Z');
    assert.equal(p.apply(root,input,now).receipts.length,1);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('首次失败固定缺口起点；其他对象成功不受影响',()=>{
  const root=fixture();try{
    p.write(root,p.apply(root,report(root,'failed'),now));
    assert.equal(p.plan(root,'2026-10-19T08:00:00+08:00','tickers')[0].start,'2026-10-18T11:43:00.000Z');
    p.write(root,p.apply(root,report(root,'searched','other','ai:openai'),now));
    assert.equal(p.read(root).units['tickers:mu'].through,undefined);
    assert.equal(p.read(root).units['ai:openai'].through,'2026-10-18T12:30:00.000Z');
    const retry=report(root,'searched');p.write(root,p.apply(root,retry,now));
    assert.equal(p.read(root).units['tickers:mu'].through,'2026-10-18T12:30:00.000Z');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('不能跨过缺口；计划、条数或缺失审计不能代替已保存结果',()=>{
  const root=fixture();try{
    p.write(root,p.apply(root,report(root),now));
    const wrong=report(root,'searched','bad','tickers:mu','2026-10-18T21:00:00+08:00','2026-10-19T08:00:00+08:00');
    assert.throws(()=>p.apply(root,wrong,now),/严格接续/);
    const missing=report(root,'searched','missing','ai:openai');fs.unlinkSync(path.join(root,missing.results[0].evidenceFile));
    assert.throws(()=>p.apply(root,missing,now));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('超过14天断档从旧截止连续分片，不跳到最近一天',()=>{
  const root=fixture();try{
    p.write(root,{schemaVersion:1,units:{'tickers:mu':{through:'2026-09-01T00:00:00Z'}},pending:[],receipts:[]});
    const next=p.plan(root,'2026-10-19T08:00:00+08:00','tickers')[0];
    assert.equal(next.start,'2026-09-01T00:00:00.000Z');assert.equal(next.end,'2026-09-15T00:00:00.000Z');assert.equal(next.catchingUp,true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
