/* Daily curiosities and paired professional/story explanations. */
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

  function curiosityCard(item) {
    const url = safeUrl(item.source?.url);
    return `<article class="learning-card curiosity-card">
      <div class="learning-card-head"><span class="badge">${escape(item.category)}</span><time>${escape(item.date)}</time></div>
      <h2>${escape(item.title)}</h2>
      <p><strong>今天发现了什么</strong>${escape(item.summary)}</p>
      <p><strong>为什么有意思</strong>${escape(item.whyInteresting)}</p>
      ${item.knowledgePointId ? `<p class="learning-link-note">它对应一个基础知识点，切到“基础知识讲解”可以继续读。</p>` : ''}
      <footer><span>${escape(item.source?.author || '来源待注明')} · ${escape(formatTime(item.source?.publishedAt))}（北京时间）</span>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>` : '<span>原帖链接待核验</span>'}</footer>
    </article>`;
  }

  function mapping(rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<dl class="story-mapping">${rows.map(row => `<div><dt>${escape(row.storyRole)}</dt><dd>${escape(row.professionalMeaning)}</dd></div>`).join('')}</dl>`;
  }

  function lessonCard(item) {
    const sources = Array.isArray(item.sources) ? item.sources : [];
    return `<article class="learning-card lesson-card">
      <header class="lesson-head"><div><span class="badge">${escape(item.category)}</span><h2>${escape(item.title)}</h2></div><time>更新 ${escape(formatTime(item.updatedAt))}</time></header>
      <div class="lesson-versions">
        <section class="lesson-version professional-version" aria-labelledby="${escape(item.id)}-professional">
          <p class="eyebrow">专业版</p><h3 id="${escape(item.id)}-professional">用术语把机制说准确</h3>
          <p><strong>定义</strong>${escape(item.professional.definition)}</p>
          <p><strong>运行机制</strong>${escape(item.professional.mechanism)}</p>
          <p><strong>为什么重要</strong>${escape(item.professional.whyItMatters)}</p>
          ${list(item.professional.signals)}
        </section>
        <section class="lesson-version story-version" aria-labelledby="${escape(item.id)}-story">
          <p class="eyebrow">故事版 · 18岁以上可读</p><h3 id="${escape(item.id)}-story">${escape(item.story.title)}</h3>
          <p>${escape(item.story.body)}</p>
          ${mapping(item.story.mapping)}
          <p class="analogy-boundary"><strong>这个故事不能代替什么</strong>${escape(item.story.boundary)}</p>
        </section>
      </div>
      ${Array.isArray(item.commonMistakes) && item.commonMistakes.length ? `<section class="lesson-mistakes"><h3>常见误区</h3>${list(item.commonMistakes)}</section>` : ''}
      ${sources.length ? `<footer>${sources.map(source => { const url=safeUrl(source.url); return url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>` : `<span>${escape(source.label)} · 链接待核验</span>`; }).join('')}</footer>` : ''}
    </article>`;
  }

  let config;
  let data;
  let journals = {reviews:[],coverage:{}};
  let journalError = false;
  const journalDates = {};
  let active = 'curiosities';

  function paperCard(item) {
    const access = config.journalPolicy.accessLabels[item.accessLevel] || '阅读范围待确认';
    const sections = [['problem','研究问题'],['method','怎么研究'],['findings','核心发现'],['statistics','统计提醒'],['limitations','局限与未证明'],['meaning','生活中的启发']];
    return `<article class="learning-card paper-card"><div class="learning-card-head"><span class="badge">${escape(item.category)}</span><span class="badge">${escape(access)}</span><span class="badge">${item.selectionKind === 'classic' ? '往期精选' : '近期研究'}</span></div>
      <h2>${escape(item.title)}</h2><p class="paper-original-title" lang="en">${escape(item.originalTitle)}</p>
      <p class="paper-identity">${escape(item.authors.join('、'))}${item.authorsTruncated?' 等':''} · ${escape(item.journalName)} · 发表 ${escape(item.publishedDate)}${item.publicationDateNote ? ' · '+escape(item.publicationDateNote) : ''}</p>
      <p class="paper-takeaway">${escape(item.takeaway)}</p><p class="paper-stage">研究阶段：${escape(item.stage)}</p>
      ${sections.map(([key,label])=>`<p><strong>${label}</strong>${escape(item.summary[key])}</p>`).join('')}
      <p class="analogy-boundary"><strong>本次阅读范围</strong>${escape(item.accessNote)}</p>
      ${(item.people||[]).length ? `<p class="paper-identity">${item.people.map(p=>`${escape(p.name)} · ${escape(p.intro)}`).join('；')}</p>` : ''}
      <footer><span>选读 ${escape(item.selectedDate)}（北京时间） · DOI ${escape(item.doi)}</span><a href="${escape(paperUrl(item.paperUrl))}" target="_blank" rel="noopener noreferrer">期刊原文 ↗</a>${item.sources.map(source=>{ const url=paperUrl(source.url);return url?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)} ↗</a>`:'';}).join('')}</footer></article>`;
  }

  function journalPanel(current) {
    const items = (journals.reviews||[]).filter(item=>item.journal===active).sort((a,b)=>b.selectedDate.localeCompare(a.selectedDate));
    const dates = [...new Set(items.map(item=>item.selectedDate))];
    const selected = dates.includes(journalDates[active]) ? journalDates[active] : dates[0];
    journalDates[active] = selected;
    const coverage = journals.coverage?.[active];
    const status = journalError ? '论文数据读取失败；原学习栏目不受影响。' : coverage && coverage.status !== 'complete' ? `${coverage.date}：${coverage.note}；此前选读仍可回看。` : '';
    return `<header class="learning-section-head"><p class="eyebrow">${escape(current.eyebrow)}</p><h2>${escape(current.label)} 论文选读</h2><p>${escape(current.description)}</p><p>${escape(config.journalPolicy.recommendedTopics.join('；'))}。</p></header>
      ${status?`<p class="paper-coverage" role="status">${escape(status)}</p>`:''}
      ${dates.length?`<div class="paper-date-toolbar"><label for="paper-date">选读日期（北京时间）</label><select id="paper-date">${dates.map(date=>`<option value="${date}"${date===selected?' selected':''}>${date}</option>`).join('')}</select><span>保留往期；论文不一定当天发表</span></div><div class="learning-list">${items.filter(item=>item.selectedDate===selected).map(paperCard).join('')}</div>`:empty('本刊暂无通过筛选的论文','每天目标一篇，不用子刊、旧闻伪装或不完整来源凑数；后续在每日学习批次补充。')}`;
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
    document.getElementById('learning-focus').textContent = ['nature','science'].includes(active) ? '健康 · 生活 · 统计 · 反直觉' : config.priorityOrder.join(' · ');
    state.textContent = ['nature','science'].includes(active) ? (journalError?'论文数据读取失败':journals.updatedAt?`选读整理于 ${formatTime(journals.updatedAt)}（北京时间）`:'正在读取论文选读') : data.updatedAt?`更新于 ${formatTime(data.updatedAt)}（北京时间）`:'栏目已建立，等待首批合格内容';
    if (active === 'curiosities') {
      const items = data.dailyCuriosities || [];
      panel.innerHTML = `<header class="learning-section-head"><p class="eyebrow">${escape(current.eyebrow)}</p><h2>${escape(current.label)}</h2><p>${escape(current.description)}</p></header>${items.length ? `<div class="learning-list">${items.map(curiosityCard).join('')}</div>` : empty('今天暂时没有值得收录的趣事','宁可空着，也不把普通动态、段子或重复新闻塞进来。')}`;
    } else if (active === 'basics') {
      const items = data.lessons || [];
      panel.innerHTML = `<header class="learning-section-head"><p class="eyebrow">${escape(current.eyebrow)}</p><h2>${escape(current.label)}</h2><p>${escape(current.description)}</p></header>${items.length ? `<div class="learning-list">${items.map(lessonCard).join('')}</div>` : empty('基础知识库正在建立','每个知识点必须同时通过专业版和故事版校验后才会发布。')}`;
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
  }).catch(error => {
    state.textContent = '学习内容读取失败';
    panel.innerHTML = empty('无法读取每日学习', error.message);
  });
})();
