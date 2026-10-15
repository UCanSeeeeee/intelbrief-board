const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const contract=require('../update-receipt'),{prepare,writeReceipt}=require('../scripts/manual-update-receipt');
const intent={requestId:'test-request-0001',requestedAt:'2026-01-01T00:00:00Z',pages:['people']};
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'intel-receipt-'));fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data/people-intelligence.json'),'{}');return root;}
const input=()=>({...intent,completedAt:'2026-01-01T00:01:00Z',results:[{page:'people',status:'unchanged',message:'所有目标已核验，无高价值新增'}]});
test('receipt verifies exact identity and deployed bytes, never just newer timestamps',async()=>{
  const root=fixture();try{
    const r=prepare(input(),root);await contract.verify(r,intent,async()=>Buffer.from('{}'),crypto.webcrypto);
    await assert.rejects(contract.verify(r,{...intent,requestId:'another-id'},async()=>Buffer.from('{}'),crypto.webcrypto),/不匹配/);
    await assert.rejects(contract.verify(r,intent,async()=>Buffer.from('{"newer":true}'),crypto.webcrypto),/版本不一致/);
    assert.throws(()=>contract.validate({...r,results:[]},intent),/缺少页面/);
    assert.throws(()=>contract.validate({...r,results:[{...r.results[0],artifacts:[{path:'https://evil.test',sha256:'a'.repeat(64)}]}]},intent),/摘要无效/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('failure is explicit and result IDs are immutable',()=>{
  const root=fixture();try{
    const data=input();data.results[0]={page:'people',status:'failed',message:'X限流，两条路径均失败，保留旧数据'};
    const file=writeReceipt(data,root);assert.deepEqual(JSON.parse(fs.readFileSync(file)).results[0].artifacts,[]);
    assert.equal(writeReceipt(data,root),file);
    assert.throws(()=>writeReceipt(input(),root),/禁止覆盖/);
    assert.throws(()=>prepare({...input(),pages:['../../secret']},root),/范围无效/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('calendar anchors date and section headers are visibly separated',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
  assert.match(css,/body\[data-page="earnings"\] \.earnings-day-head \{ position: sticky; top: 0/);
  assert.match(css,/\.signal-section \+ \.signal-section \{ margin-top: 40px/);
  assert.match(fs.readFileSync(path.join(__dirname,'../earnings.js'),'utf8'),/美东披露日期/);
  for(const page of ['index','people','tickers','ai'])assert.match(fs.readFileSync(path.join(__dirname,'../'+page+'.html'),'utf8'),/update-receipt.js[\s\S]*updates.js/);
});
