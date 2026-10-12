#!/usr/bin/env node
// Grok-only publishing helper. Does not collect, dispatch, commit or push.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const contract=require('../update-receipt');
function prepare(input,root){
  const intent={requestId:input.requestId,requestedAt:input.requestedAt,pages:input.pages};
  if(!contract.validIntent(intent))throw new Error('请求编号、时间或范围无效');
  if(!Array.isArray(input.results))throw new Error('需要每个页面的实际结果');
  const receipt={schemaVersion:2,...intent,completedAt:input.completedAt,results:input.results.map(r=>({page:r.page,status:r.status,message:r.message,artifacts:r.status==='failed'?[]:(contract.paths[r.page]||[]).map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))}))};
  contract.validate(receipt,intent);
  return receipt;
}
function writeReceipt(input,root){
  const receipt=prepare(input,root),file=path.join(root,'data/update-receipts',receipt.requestId+'.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  // Immutable identity. Reruns may confirm the exact same result, never replace it.
  if(fs.existsSync(file)){
    if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(receipt))throw new Error('该请求已存在不同结果，禁止覆盖；先查原任务');
    return file;
  }
  fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return file;
}
if(require.main===module){
  try{if(!process.argv[2])throw new Error('用法：npm run updates:receipt -- <结果JSON文件>');const root=path.resolve(__dirname,'..');const file=writeReceipt(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),root);console.log(path.relative(root,file)+' 已准备；尚未提交、推送或核验线上，不能称为完成。');}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={prepare,writeReceipt};
