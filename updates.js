/* Retain only non-secret request metadata on this device, never credentials. */
(function(){
  const page=document.body.dataset.page,contract=IntelUpdateReceipt;
  if(!contract.pages.includes(page))return;
  const names={news:'美股讯息',people:'具体人物',tickers:'具体个股',ai:'AI板块',crypto:'加密'};
  const labels={complete:'更新完成',partial:'部分完成',unchanged:'已检查，暂无高价值新增',failed:'更新失败'};
  const storageKey='intelbrief-manual-request-v2',waitLimit=30*60000;
  const time=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  const sidebar=document.createElement('div');sidebar.className='update-sidebar';
  sidebar.innerHTML='<button class="update-button" id="update-all" type="button">↻ 全部更新</button>';
  document.querySelector('.sidebar .nav').after(sidebar);
  const toolbar=document.createElement('div');toolbar.className='update-page-toolbar';
  toolbar.innerHTML='<span id="update-last" role="status">正在检查更新连接…</span><button class="update-button" id="update-page" type="button">↻ 更新本页</button>';
  document.querySelector('.page-header').append(toolbar);
  const panel=document.createElement('section');panel.id='update-panel';panel.className='update-panel';panel.hidden=false;
  panel.setAttribute('aria-label','内容更新');
  panel.innerHTML='<p id="update-connection" role="status"></p><p id="update-error" role="alert"></p><form id="update-login" hidden><label for="update-key">管理密钥</label><div class="update-login-row"><input id="update-key" type="password" autocomplete="current-password" required maxlength="128"/><button class="update-button" type="submit">登录</button></div></form><div class="update-panel-actions"><button class="update-button" id="update-view" type="button" hidden>查看本次请求</button><button id="update-logout" type="button" hidden>退出管理</button></div>';
  document.querySelector('.page-header').after(panel);
  const dialog=document.createElement('dialog');dialog.className='update-dialog';dialog.setAttribute('aria-labelledby','update-title');
  dialog.innerHTML='<h2 id="update-title">请 Grok 跑一趟</h2><p id="update-scope"></p><p class="update-humor">Grok 出门找消息，可惜没带对讲机。我们不表演假进度条，只认带编号的结果。</p><p id="update-explanation"></p><p id="update-request-number" class="brief-small"></p><p id="update-result" role="status" aria-live="polite"></p><label id="update-copy-label" for="update-prompt" hidden>发给 Grok Bot「X+github」的完整指令</label><textarea id="update-prompt" readonly hidden></textarea><div class="update-dialog-actions"><button class="update-button" id="update-confirm" type="button">确认更新</button><button class="update-button" id="update-copy" type="button" hidden>复制指令，去 Grok 发送</button><button class="update-button" id="update-sent" type="button" hidden>我已在 Grok 发送，开始核对</button><button class="update-button" id="update-check" type="button" hidden>核对本次结果</button><button class="update-button" id="update-retry" type="button" hidden>仅重试失败页面</button><button class="update-button" id="update-dismiss" type="button">先看新闻</button><button class="update-button" id="update-reset" type="button" hidden>结束本次查看</button></div>';
  document.body.append(dialog);
  const $=id=>document.getElementById(id);
  let authenticated=false,direct=false,submitting=false,checking=false,intent=null,receipt=null,selection=[page],returnFocus=null,outcome='',persistent=true;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(contract.validIntent(saved)&&Date.now()-Date.parse(saved.requestedAt)<7*86400000)intent=saved;else localStorage.removeItem(storageKey);}catch{persistent=false;}
  function save(){try{if(intent)localStorage.setItem(storageKey,JSON.stringify(intent));else localStorage.removeItem(storageKey);}catch{persistent=false;}}
  function create(pages){intent={requestId:crypto.randomUUID(),requestedAt:new Date().toISOString(),pages,delivery:'draft'};receipt=null;outcome='';save();}
  const pending=()=>!!intent&&!receipt&&intent.delivery!=='draft';
  const timedOut=()=>pending()&&Date.now()-Date.parse(intent.requestedAt)>=waitLimit;
  async function api(path='',input){
    const response=await fetch('/api/updates'+path,{method:input?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:input?{'Content-Type':'application/json'}:{},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(15000)});
    const data=await response.json().catch(()=>({error:'连接暂时不可用'}));
    if(!response.ok)throw Object.assign(new Error(data.error||'请求失败'),{status:response.status,data});
    return data;
  }
  function prompt(){return `请执行 intelbrief-board 的网页手动更新。先安全拉取 origin master，遵循 AGENTS.md、docs/MANUAL_UPDATES.md 的当前规则及各页 SOP；你独立执行，GPT 不代采集。\n请求编号：${intent.requestId}\n请求时间：${intent.requestedAt}\n页面范围：${intent.pages.join(',')}（${intent.pages.map(p=>names[p]).join('、')}）\n与现有定时/手动任务串行，按编号幂等，不覆盖已有期次；检索清单、知识库、两轮检索及质量门槛均不放宽，不凑数。完成后按 docs/MANUAL_UPDATES.md 的 v2 结果凭证协议，运行 npm run updates:receipt -- <本次结果JSON文件>，校验并提交推送内容及 data/update-receipts/${intent.requestId}.json，核对线上内容与凭证。只重试失败阶段，最多两次。部分完成、无新增、失败分别如实报告；不要只在聊天里说已完成。返回同一编号、各页结果、提交和线上核验情况。`;}
  function render(){
    const waiting=pending(),expired=timedOut();
    $('update-page').disabled=submitting;$('update-all').disabled=submitting;
    $('update-page').textContent=waiting?'查看更新请求':'↻ 更新本页';$('update-all').textContent=waiting?'查看更新请求':'↻ 全部更新';
    $('update-view').hidden=!intent;$('update-login').hidden=!direct||authenticated;$('update-logout').hidden=!authenticated;
    $('update-last').textContent=receipt?'本次结果已核对':expired?'结果尚未确认 · 可到 Grok 查看':waiting?'等待本次结果 · 可以继续浏览':direct?'可提交给 Grok':'网页直连尚未接通 · 可复制指令到 Grok';
    $('update-connection').textContent=receipt?outcome:waiting?(expired?'等待已超过 30 分钟，不代表任务失败。已停止自动轮询，可手动核对或带请求编号询问 Grok；请勿反复新建任务。':'没有实时运行状态；网页每 15 秒核对本次结果。关闭页面不取消已交给 Grok 的任务。'):(direct?'提交只表示送达入口，核对线上结果后才算完成。':'点击更新可获得带编号的指令，发送到 X+github 后回来核对；复制本身不会启动任务。');
    $('update-scope').textContent='范围：'+(intent?.pages||selection).map(p=>names[p]).join('、');
    $('update-request-number').textContent=intent?`编号 ${intent.requestId} · ${time(intent.requestedAt)}（北京时间）`:'';
    $('update-explanation').textContent=receipt?'结果已按请求编号和线上文件核对；没有新增不等于失败。':waiting?'你可以关掉弹窗继续看。没有实时状态回传，所以不会显示“正在检索 80%”之类猜测。超过 30 分钟停止自动核对并给出下一步，不会偷偷再发一次任务。':direct?'确认后提交到 Grok。全部更新按页面串行处理，耗时不保证；不按数量凑新闻。':'目前网页还不能直接叫到 Grok：复制下方指令，粘贴给 Grok Bot「X+github」，发送后点“我已在 Grok 发送”。这是手动交接，不会伪装成一键送达。';
    if(!persistent)$('update-explanation').textContent+=' 此浏览器无法保存请求，离开前请复制编号；关闭后可能无法恢复核对。';
    $('update-result').textContent=outcome||(expired?'迟到了，但先别催出第二个 Grok。请到原对话确认；这里随时可以手动核对。':intent?.delivery==='uncertain'?'网络没有确认送达；请先核对或在 Grok 按同一编号查询，不要另建请求。':intent?.delivery==='accepted'?'入口已受理，尚未确认开始或完成。':intent?.delivery==='manual'?'你已标记在 Grok 发送；网页尚未收到结果凭证。':'');
    $('update-confirm').hidden=!direct||waiting||!!receipt;$('update-confirm').disabled=submitting;
    const handoff=!direct&&!receipt&&!waiting;
    $('update-copy').hidden=!intent||!!receipt;$('update-copy').disabled=submitting;
    $('update-copy-label').hidden=!handoff;$('update-prompt').hidden=!handoff;
    const instruction=intent?prompt():'';if($('update-prompt').value!==instruction)$('update-prompt').value=instruction;
    $('update-sent').hidden=!handoff;$('update-check').hidden=!intent||(!waiting&&!receipt);$('update-check').disabled=checking;
    $('update-retry').hidden=!receipt?.results.some(r=>r.status==='failed');$('update-reset').hidden=!intent||submitting;
  }
  function open(pages){returnFocus=document.activeElement;selection=pages;if(!intent)create(pages);else if(intent.delivery==='draft'&&intent.pages.join()!==pages.join())create(pages);render();if(!dialog.open){dialog.showModal();$('update-title').tabIndex=-1;$('update-title').focus();}}
  async function connection(){
    try{const state=await api();authenticated=!!state.authenticated;direct=state.delivery==='grok-webhook';}
    catch(error){authenticated=false;direct=error.status===401&&error.data?.delivery==='grok-webhook';}
    render();
  }
  async function checkResult(){
    if(!intent||checking)return;const current=intent;checking=true;render();
    try{
      const response=await fetch(`/data/update-receipts/${current.requestId}.json?t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(response.status===404){if(intent===current)outcome='尚未找到本次结果凭证；请以 Grok 对话中的同一编号查询。';return;}
      if(!response.ok)throw new Error('暂时无法读取结果，稍后可手动核对；不会重复提交。');
      const found=await response.json();
      await contract.verify(found,current,async path=>{const file=await fetch('/'+path+'?request='+current.requestId+'&t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!file.ok)throw new Error('线上内容尚不可读，请稍后核对。');return file.arrayBuffer();},crypto);
      if(intent!==current)return;receipt=found;
      outcome=receipt.results.map(r=>`${names[r.page]}：${labels[r.status]}。${r.message}`).join('\n');
      for(const result of receipt.results)if(result.status!=='failed')document.dispatchEvent(new CustomEvent('intelbrief:updated',{detail:{page:result.page}}));
    }catch(error){if(intent===current)outcome=error.message||'核对暂时失败，请稍后重试。';}
    finally{checking=false;render();}
  }
  $('update-page').onclick=()=>open([page]);$('update-all').onclick=()=>open(contract.pages);$('update-view').onclick=()=>open(intent.pages);
  $('update-dismiss').onclick=()=>dialog.close();dialog.addEventListener('close',()=>returnFocus?.focus());
  $('update-confirm').onclick=async()=>{
    if(submitting||pending()||receipt)return;
    if(!authenticated){dialog.close();$('update-key').focus();return;}
    submitting=true;intent.delivery='uncertain';save();render();
    try{const result=await api('',{requestId:intent.requestId,requestedAt:intent.requestedAt,pages:intent.pages});if(result.delivery!=='grok-webhook')throw new Error('服务器未确认送达 Grok；保留同一编号，请勿重复新建。');if(result.merged&&contract.validIntent({...result,delivery:'accepted'})){intent={requestId:result.requestId,requestedAt:result.requestedAt,pages:result.pages,delivery:'uncertain'};outcome='已有相同范围的请求在处理，已合并到该编号。';}if(result.accepted===true){intent.delivery='accepted';outcome=(outcome?outcome+' ':'')+'入口已受理；等待带编号的线上结果。';}else{intent.delivery='uncertain';outcome=(outcome?outcome+' ':'')+'服务器未确认送达 Grok（送达未确认）：保留同一编号，不会自动重发；请稍后核对。';}}
    catch(error){const msg=error.message;if(error.status===502)create(intent.pages);else if(error.status===400||error.status===409||error.status===401)intent.delivery='draft';outcome=msg;}finally{submitting=false;save();render();}
  };
  $('update-copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(prompt());outcome='指令已复制，尚未发送。请粘贴到 X+github 后发送；同一编号只执行一次。';}
    catch{$('update-prompt').hidden=false;$('update-copy-label').hidden=false;$('update-prompt').focus();$('update-prompt').select();outcome='自动复制不可用，请长按或全选复制下方指令。';}
    $('update-result').textContent=outcome;
  };
  $('update-sent').onclick=()=>{intent.delivery='manual';save();render();return checkResult();};$('update-check').onclick=checkResult;
  $('update-retry').onclick=()=>{const failed=receipt.results.filter(r=>r.status==='failed').map(r=>r.page);create(failed);render();};
  $('update-reset').onclick=()=>{if(pending()&&!confirm('只结束网页对本次请求的查看，不会取消 Grok 的任务。请确认原任务已结束，再发新请求，避免重复采集。'))return;intent=null;receipt=null;outcome='';save();dialog.close();render();};
  $('update-login').onsubmit=async event=>{event.preventDefault();const key=$('update-key').value;$('update-key').value='';try{await api('/login',{key});$('update-error').textContent='';await connection();}catch(error){$('update-error').textContent=error.message;}};
  $('update-logout').onclick=async()=>{try{await api('/logout',{});await connection();}catch(error){$('update-error').textContent=error.message;}};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(pending()&&!timedOut())checkResult();}});
  setInterval(()=>{if(!document.hidden){render();if(pending()&&!timedOut())checkResult();}},15000);
  connection();if(pending())checkResult();else render();
})();
