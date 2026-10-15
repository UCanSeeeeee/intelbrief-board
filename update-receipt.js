/* Public result contract: exact request identity plus deployed file hashes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IntelUpdateReceipt=api;})(globalThis,function(){
  const pages=['news','people','tickers','ai'];
  const paths={news:['data/reading-board.json','data/stock-briefs/index.json'],people:['data/people-intelligence.json'],tickers:['data/ticker-intelligence.json'],ai:['data/ai-intelligence.json']};
  const timeOK=t=>typeof t==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(t)&&Number.isFinite(Date.parse(t));
  function validIntent(i){return !!i&&typeof i.requestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(i.requestId)&&timeOK(i.requestedAt)&&Array.isArray(i.pages)&&i.pages.length>0&&i.pages.length<=4&&new Set(i.pages).size===i.pages.length&&i.pages.every(p=>pages.includes(p));}
  function validate(r,i){
    if(!validIntent(i)||r?.schemaVersion!==2||r.requestId!==i.requestId||r.requestedAt!==i.requestedAt)throw new Error('结果凭证与本次请求不匹配');
    if(!timeOK(r.completedAt)||Date.parse(r.completedAt)<Date.parse(i.requestedAt)||Date.parse(r.completedAt)>Date.now()+60000)throw new Error('结果凭证时间无效');
    if(!Array.isArray(r.results)||r.results.length!==i.pages.length||new Set(r.results.map(x=>x.page)).size!==i.pages.length)throw new Error('结果凭证缺少页面');
    for(const x of r.results){
      if(!i.pages.includes(x.page)||!['complete','partial','unchanged','failed'].includes(x.status)||typeof x.message!=='string'||!x.message.trim())throw new Error('结果凭证状态或说明无效');
      if(!Array.isArray(x.artifacts))throw new Error('结果凭证缺少文件核验信息');
      if(x.status==='failed'){if(x.artifacts.length)throw new Error('失败结果不得冒充发布文件');continue;}
      if(x.artifacts.length!==paths[x.page].length||new Set(x.artifacts.map(a=>a.path)).size!==paths[x.page].length||x.artifacts.some(a=>!paths[x.page].includes(a.path)||!/^[a-f0-9]{64}$/.test(a.sha256)))throw new Error('结果文件或摘要无效');
    }
    return r;
  }
  async function verify(r,i,fetchFile,cryptoAPI){
    validate(r,i);
    for(const x of r.results)for(const a of x.artifacts){
      const bytes=await fetchFile(a.path);
      const hash=Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==a.sha256)throw new Error('凭证已到，但线上版本不一致；可能仍在部署或已有后续更新，请到 Grok 核对本次编号');
    }
    return r;
  }
  return {pages,paths,validIntent,validate,verify};
});
