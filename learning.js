/* Paired knowledge explanations and daily journal/knowledge selections. */
(function () {
  const tabsNode = document.getElementById('learning-tabs');
  const panel = document.getElementById('learning-panel');
  const state = document.getElementById('learning-state');
  if (!tabsNode || !panel || !state) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const safeUrl = value => /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(value || '') ? value : '';
  const paperUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const formatTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value)) : '时间未查明';
  const list = values => Array.isArray(values) && values.length ? `<ul>${values.map(value => `<li>${escape(value)}</li>`).join('')}</ul>` : '';

  async function json(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取 ${url} 失败`);
    return response.json();
  }

  function empty(title, text) {
    return `<div class="empty-state"><strong>${escape(title)}</strong><p>${escape(text)}</p></div>`;
  }

  function mapping(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<dl class="story-mapping">${rows.map(row => `<div><dt>${escape(row.storyRole)}</dt><dd>${escape(row.professionalMeaning)}</dd></div>`).join('')}</dl>`;
  }

  function lessonCard(item) {
    const sources = Array.isArray(item.sources) ? item.sources : [];
    if (item.format === 'fable-reveal') {
      return `<article id="lesson-${escape(item.id)}" class="learning-card lesson-card fable-card">
        <header class="lesson-head"><h2>${escape(item.title)}</h2><time>更新 ${escape(formatTime(item.updatedAt))}</time></header>
        <div class="lesson-versions">
          <section class="lesson-version fable-story" aria-label="寓言故事">
            ${String(item.story.body).split(/\n\s*\n/).filter(Boolean).map(paragraph=>`<p>${escape(paragraph)}</p>`).join('')}
          </section>
          <section class="lesson-version fable-explanation" aria-labelledby="${escape(item.id)}-concept">
            <h3 id="${escape(item.id)}-concept">故事背后：${escape(item.concept)}</h3>
            <p><strong>定义</strong>${escape(item.professional.definition)}</p>
            <p><strong>运行机制</strong>${escape(item.professional.mechanism)}</p>
            <p><strong>为什么重要</strong>${escape(item.professional.whyItMatters)}</p>
            ${list(item.professional.signals)}
            ${mapping(item.story.mapping)}
            <p class="analogy-boundary"><strong>类比边界</strong>${escape(item.story.boundary)}</p>
          </section>
        </div>
        ${item.commonMistakes?.length?`<section class="lesson-mistakes"><h3>常见误区</h3>${list(item.commonMistakes)}</section>`:''}
        ${sources.length?`<footer>${sources.map(source=>{const url=paperUrl(source.url);return url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`:'';}).join('')}</footer>`:''}
      </article>`;
    }
    return `<article id="lesson-${escape(item.id)}" class="learning-card lesson-card">
      <header class="lesson-head"><div><span class="lesson-category">${escape(item.category)}</span><h2>${escape(item.title)}</h2></div><time>更新 ${escape(formatTime(item.updatedAt))}</time></header>
      <div class="lesson-versions">
        <section class="lesson-version professional-version" aria-labelledby="${escape(item.id)}-professional">
          <h3 id="${escape(item.id)}-professional">专业版</h3>
          <p><strong>定义</strong>${escape(item.professional.definition)}</p>
          <p><strong>运行机制</strong>${escape(item.professional.mechanism)}</p>
          <p><strong>为什么重要</strong>${escape(item.professional.whyItMatters)}</p>
          ${list(item.professional.signals)}
        </section>
        <section class="lesson-version story-version" aria-labelledby="${escape(item.id)}-story">
          <h3 id="${escape(item.id)}-story">故事版</h3><p class="story-title">${escape(item.story.title)}</p>
          <p>${escape(item.story.body)}</p>
          ${mapping(item.story.mapping)}
          <p class="analogy-boundary"><strong>这个故事不能代替什么</strong>${escape(item.story.boundary)}</p>
        </section>
      </div>
      ${Array.isArray(item.commonMistakes) && item.commonMistakes.length ? `<section class="lesson-mistakes"><h3>常见误区</h3>${list(item.commonMistakes)}</section>` : ''}
      ${sources.length ? `<footer>${sources.map(source => { const url=source.url==='https://github.com/UCanSeeeeee/intelbrief-board/blob/master/knowledge/US_EQUITY_RESEARCH_KB.md'?paperUrl(source.url):safeUrl(source.url); return url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>` : `<span>${escape(source.label)} · 链接待核验</span>`; }).join('')}</footer>` : ''}
    </article>`;
  }

  let config;
  let data;
  let journals = {reviews:[],coverage:{}};
  let journalError = false;
  let counterintuitive = {updatedAt:null, editions:[]};
  let counterError = false;
  let counterLoaded = false;
  let counterDate;
  const journalDates = {};
  let active = 'basics';

  function paperCard(item) {
    const sections = [['method','实验过程'],['findings','实验结果'],['limitations','结论边界']];
    return `<article class="learning-card paper-card">
      <h2>${escape(item.title)}</h2>
      <p class="paper-identity">${escape(item.authors.join('、'))}${item.authorsTruncated?' 等':''} · 发表 ${escape(item.publishedDate)}${item.selectionKind === 'classic'?' · 往期':''}</p>
      <p class="paper-takeaway"><strong>结论</strong>${escape(item.takeaway)}</p>
      <div class="paper-detail-grid">${sections.map(([key,label])=>`<section class="paper-detail paper-${key}"><h3>${label}</h3><p>${escape(item.summary[key])}</p></section>`).join('')}</div>
      <footer><a href="${escape(paperUrl(item.paperUrl))}" target="_blank" rel="noopener noreferrer">原论文 ↗</a>${item.sources.filter(source=>!source.url.includes('#change-history')).map(source=>{ const url=paperUrl(source.url);return url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`:'';}).join('')}</footer></article>`;
  }

  function journalPanel(current) {
    const items = (journals.reviews||[]).filter(item=>item.journal===active).sort((a,b)=>b.selectedDate.localeCompare(a.selectedDate));
    const dates = [...new Set(items.map(item=>item.selectedDate))];
    const selected = dates.includes(journalDates[active]) ? journalDates[active] : dates[0];
    journalDates[active] = selected;
    const status = journalError ? '论文读取失败' : '';
    return `
      ${status?`<p class="paper-coverage" role="status">${escape(status)}</p>`:''}
      ${dates.length?`${dates.length>1?`<div class="paper-date-toolbar"><label for="paper-date">日期</label><select id="paper-date">${dates.map(date=>`<option value="${date}"${date===selected?' selected':''}>${date}</option>`).join('')}</select></div>`:''}<div class="learning-list">${items.filter(item=>item.selectedDate===selected).map(paperCard).join('')}</div>`:empty('暂无选读','')}`;
  }

  function counterCard(item) {
    const sections = [['intuition','常见直觉'],['fact','证据怎么说'],['explanation','为什么'],['boundary','适用边界']];
    return `<article class="learning-card counter-card"><div class="learning-card-head"><span class="lesson-category">${escape(item.topic)}</span></div><h2>${escape(item.title)}</h2>
      <div class="knowledge-detail-grid">${sections.map(([key,label])=>`<section><h3>${label}</h3><p>${escape(item[key])}</p></section>`).join('')}</div>
      ${item.people.length?`<p class="paper-identity">${item.people.map(p=>`${escape(p.name)} · ${escape(p.intro)}`).join('；')}</p>`:''}
      <footer>${item.sources.map(source=>{const url=paperUrl(source.url);return `<span>${escape(source.publisher)}${source.publishedDate?' · '+escape(source.publishedDate):''}</span>${url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`:''}`;}).join('')}</footer></article>`;
  }

  function counterPanel(current) {
    const editions = [...counterintuitive.editions].sort((a,b)=>b.date.localeCompare(a.date));
    const available = editions.filter(edition=>edition.items.length);
    if(!available.some(edition=>edition.date===counterDate))counterDate=available[0]?.date;
    const selected = available.find(edition=>edition.date===counterDate);
    const latest = editions[0];
    const note = counterError ? '小知识读取失败' : latest?.coverage.status==='failed' ? '本次更新失败' : '';
    return `
      ${note?`<p class="paper-coverage" role="status">${escape(note)}</p>`:''}
      ${selected?`<div class="paper-date-toolbar"><label for="counter-date">日期</label><select id="counter-date">${available.map(edition=>`<option value="${edition.date}"${edition.date===counterDate?' selected':''}>${edition.date}</option>`).join('')}</select></div><div class="learning-list">${selected.items.map(counterCard).join('')}</div>`:empty(counterLoaded?'暂无小知识':'正在读取','')}`;
  }

  function render() {
    tabsNode.querySelectorAll('[role="tab"]').forEach(button => {
      const selected = button.dataset.tab === active;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const current = config.tabs.find(tab => tab.id === active);
    panel.setAttribute('aria-labelledby', `learning-tab-${active}`);
    state.textContent = ['nature','science'].includes(active) ? (journalError?'论文数据读取失败':journals.updatedAt?`选读整理于 ${formatTime(journals.updatedAt)}（北京时间）`:'正在读取论文选读') : data.updatedAt?`更新于 ${formatTime(data.updatedAt)}（北京时间）`:'栏目已建立，等待首批合格内容';
    if(active==='counterintuitive')state.textContent = counterError?'小知识读取失败':counterintuitive.updatedAt?`小知识整理于 ${formatTime(counterintuitive.updatedAt)}（北京时间）`:counterLoaded?'栏目已建立，等待每日学习批次':'正在读取小知识';
    if (active === 'basics') {
      const items = [...(data.lessons || [])].sort((a,b)=>Date.parse(b.updatedAt||b.date||0)-Date.parse(a.updatedAt||a.date||0));
      panel.innerHTML = items.length ? `<nav class="daily-jumps" aria-label="知识目录">${items.map(i=>`<a href="#lesson-${escape(i.id)}">${escape(i.title)}</a>`).join('')}</nav><div class="learning-list">${items.map(lessonCard).join('')}</div>` : empty('暂无知识讲解','');
    } else if(active==='counterintuitive') {
      panel.innerHTML = counterPanel(current);
    } else {
      panel.innerHTML = journalPanel(current);
    }
    const url = new URL(location.href);
    url.searchParams.set('tab', active);
    history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }

  function activate(id, focus) {
    if (!config.tabs.some(tab => tab.id === id)) return;
    active = id;
    render();
    if (focus) tabsNode.querySelector(`[data-tab="${CSS.escape(id)}"]`)?.focus();
  }

  tabsNode.addEventListener('click', event => {
    const button = event.target.closest('[role="tab"]');
    if (button) activate(button.dataset.tab);
  });
  panel.addEventListener('change', event => { if(event.target.id==='paper-date'){journalDates[active]=event.target.value;render();document.getElementById('paper-date')?.focus();} });
  panel.addEventListener('change', event => { if(event.target.id==='counter-date'){counterDate=event.target.value;render();document.getElementById('counter-date')?.focus();} });
  tabsNode.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0, config.tabs.findIndex(tab => tab.id === active));
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? config.tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + config.tabs.length) % config.tabs.length;
    activate(config.tabs[index].id, true);
  });

  Promise.all([json('config/learning.json'), json('data/learning.json')]).then(([settings, content]) => {
    config = settings;
    data = content;
    tabsNode.innerHTML = config.tabs.map(tab => `<button type="button" role="tab" id="learning-tab-${escape(tab.id)}" aria-controls="learning-panel" aria-selected="false" tabindex="-1" data-tab="${escape(tab.id)}"><strong>${escape(tab.label)}</strong></button>`).join('');
    const requested = new URLSearchParams(location.search).get('tab');
    active = config.tabs.some(tab => tab.id === requested) ? requested : config.tabs[0].id;
    state.textContent = data.updatedAt ? `更新于 ${formatTime(data.updatedAt)}（北京时间）` : '栏目已建立，等待首批合格内容';
    render();
    json('data/journal-learning.json').then(content=>{journals=content; if(['nature','science'].includes(active))render();}).catch(()=>{journalError=true; if(['nature','science'].includes(active))render();});
    json('data/counterintuitive-learning.json').then(content=>{if(content.schemaVersion!==1||!Array.isArray(content.editions))throw new Error('小知识数据结构无效');counterintuitive=content;counterLoaded=true;if(active==='counterintuitive')render();}).catch(()=>{counterError=true;counterLoaded=true;if(active==='counterintuitive')render();});
  }).catch(error => {
    state.textContent = '学习内容读取失败';
    panel.innerHTML = empty('无法读取每日学习', error.message);
  });
})();
