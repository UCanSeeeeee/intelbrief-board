/* High-signal AI labs and policy intelligence. All dynamic strings are escaped. */
(function () {
  const selector = document.getElementById('ai-selector');
  const detail = document.getElementById('ai-detail');
  const state = document.getElementById('ai-state');
  if (!selector || !detail || !state) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const parseTime = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const formatTime = value => parseTime(value) ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value)) : '时间未查明';
  const safeUrl = value => /^https:\/\/(?:x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(value || '') ? value : '';

  async function json(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`读取 ${url} 失败`);
    return response.json();
  }

  function itemKey(item) {
    return item.eventKey || item.id || item.url || `${item.title || ''}-${item.publishedAt || ''}`;
  }

  function evidenceLabel(item) {
    return {
      primary: '一手来源',
      corroborated: '标注为已交叉核验',
      'collector-report': '待独立核验',
      partial: '证据尚有缺口'
    }[item.verification] || '核验状态待注明';
  }

  function renderCard(item, extraBadge) {
    const url = safeUrl(item.url);
    const affected = Array.isArray(item.affected) ? item.affected : [];
    return `<article class="signal-card">
      <div class="signal-card-head">
        <div class="signal-badges">
          <span class="signal-tier signal-${escape(item.tier || 'watch')}">${item.tier === 'must-read' ? '必须看' : '值得跟踪'}</span>
          ${extraBadge ? `<span class="signal-new">${escape(extraBadge)}</span>` : ''}
        </div>
        <time>${escape(formatTime(item.publishedAt))}（北京时间）</time>
      </div>
      <h4>${escape(item.title || '未命名事件')}</h4>
      <p class="signal-verification">${escape(item.author || '来源待注明')} · ${escape(evidenceLabel(item))}</p>
      <p class="signal-fact"><strong>信息摘要</strong>${escape(item.fact || '尚未写明')}</p>
      <details class="analysis-details"><summary>影响分析与反向条件</summary>
      <p><strong>影响判断</strong>${escape(item.whyItMatters || '尚未写明')}</p>
      ${affected.length ? `<div class="topic-row">${affected.map(value => `<span>${escape(value)}</span>`).join('')}</div>` : ''}
      ${item.counterCase ? `<p class="signal-counter"><strong>反向条件</strong>${escape(item.counterCase)}</p>` : ''}
      </details>
      <footer><span>${escape(item.author || '来源待注明')} · ${escape(evidenceLabel(item))}</span>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>` : '<span>原帖链接待核验</span>'}</footer>
    </article>`;
  }

  function windowDays(tab, kind) {
    const value = Number(kind === 'latest' ? tab.latestWindowDays : tab.weeklyWindowDays);
    return Number.isFinite(value) && value > 0 ? value : (kind === 'latest' ? 1 : 7);
  }
  function windowMs(tab, kind) { return windowDays(tab, kind) * 86400000; }
  function windowLabel(days) {
    if (days === 1) return '24 小时';
    if (days === 7) return '滚动 7 天';
    return `近 ${days} 天`;
  }
  function emptySection(kind, tab) {
    const limit = kind === 'latest' ? tab.latestLimit : tab.weeklyLimit;
    const days = windowDays(tab, kind);
    return `<div class="empty-state signal-empty"><strong>当前没有达到门槛的信息</strong><p>${kind === 'latest' ? `${windowLabel(days)}区最多 ${limit} 条，但不会为了凑数加入普通动态。` : `${windowLabel(days)}最多 ${limit} 件；不足时保留实际数量。`}</p></div>`;
  }

  function section(title, note, sectionItems, kind, tab, latestKeys) {
    let visible = sectionItems;
    let duplicateCount = 0;
    if (kind === 'weekly') {
      duplicateCount = sectionItems.filter(item => latestKeys.has(itemKey(item))).length;
      visible = sectionItems.filter(item => !latestKeys.has(itemKey(item)));
    }
    return `<section class="signal-section" aria-labelledby="${escape(tab.id)}-${kind}">
      <header class="signal-section-head">
        <div><p class="eyebrow">${escape(note)}</p><h3 id="${escape(tab.id)}-${kind}">${escape(title)}</h3></div>
        <span>收录 ${sectionItems.length} 条 · 上限 ${kind === 'latest' ? tab.latestLimit : tab.weeklyLimit} 条</span>
      </header>
      ${duplicateCount ? `<p class="signal-dedup">重点榜中有 ${duplicateCount} 件已在新增价值区完整展示，这里不重复铺卡。</p>` : ''}
      <div class="signal-list">${visible.length ? visible.map(item => renderCard(item, kind === 'weekly' && parseTime(item.publishedAt) >= Date.now() - windowMs(tab, 'latest') ? `${windowDays(tab,'latest')===1?'24h':'近窗'}新增` : '')).join('') : (duplicateCount ? '' : emptySection(kind, tab))}</div>
    </section>`;
  }

  function renderTab(tab, intelligenceItems) {
    selector.querySelectorAll('[role="tab"]').forEach(button => {
      const isActive = button.dataset.tab === tab.id;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    const now = Date.now();
    const tabItems = intelligenceItems.filter(item => Array.isArray(item.tabIds) && item.tabIds.includes(tab.id));
    const sorted = [...tabItems].sort((a, b) => parseTime(b.publishedAt) - parseTime(a.publishedAt));
    const latestDays = windowDays(tab, 'latest');
    const weeklyDays = windowDays(tab, 'weekly');
    const latest = sorted.filter(item => parseTime(item.publishedAt) >= now - windowMs(tab, 'latest')).slice(0, tab.latestLimit);
    const rankFor = item => item.weeklyRanks?.[tab.id] ?? item.weeklyRank;
    const weekly = sorted.filter(item => parseTime(item.publishedAt) >= now - windowMs(tab, 'weekly') && rankFor(item) != null)
      .sort((a, b) => Number(rankFor(a)) - Number(rankFor(b))).slice(0, tab.weeklyLimit);
    const latestKeys = new Set(latest.map(itemKey));
    const handles = Array.isArray(tab.handles) && tab.handles.length ? tab.handles : (tab.handle ? [tab.handle] : []);
    const account = handles.length
      ? handles.map(h => `<a href="https://x.com/${escape(h)}" target="_blank" rel="noopener noreferrer">@${escape(h)} ↗</a>`).join(' · ')
      : (tab.cashtag ? `<span>${escape(tab.cashtag)}</span>` : '<span>检索锚点见筛选边界</span>');
    const assetEyebrow = tab.type === 'collection' ? '合集 Tab' : (tab.type === 'org' ? '实验室 Tab' : '标的 Tab');
    const contract = tab.contractAddress ? `<p class="ticker-contract"><strong>合约</strong><code>${escape(tab.contractAddress)}</code></p>` : '';

    detail.innerHTML = `<header class="person-profile intelligence-profile">
      <div class="person-avatar" aria-hidden="true">${escape(tab.shortLabel || tab.label)}</div>
      <div class="profile-copy"><p class="eyebrow">${assetEyebrow}</p><h2>${escape(tab.label)}${tab.cashtag ? ` · ${escape(tab.cashtag)}` : ''}</h2><div class="profile-source">${account}</div><p>${escape(tab.identity)}</p>${contract}</div>
      <div class="person-count"><strong>${latest.length}</strong><span>${windowLabel(latestDays)}收录</span></div>
    </header>
    <details class="reading-rules"><summary>关注范围与收录规则</summary><div class="tab-research-rule">
      <p><strong>关注范围</strong>${escape(tab.focus)}</p>
      <p><strong>筛选边界</strong>${escape(tab.sourceRule)}</p>
    </div></details>
    ${section(`${windowLabel(latestDays)}新增价值`, `最多 ${tab.latestLimit} 条`, latest, 'latest', tab, latestKeys)}
    ${section(`${windowLabel(weeklyDays)}最重要五件事`, `${windowLabel(weeklyDays)} · 最多 ${tab.weeklyLimit} 件`, weekly, 'weekly', tab, latestKeys)}`;

    const url = new URL(location.href);
    url.searchParams.delete('person');
    url.searchParams.delete('ticker');
    url.searchParams.set('tab', tab.id);
    history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  }

  let tabs = [];
  let items = [];
  let active;

  function activate(tab, focus) {
    if (!tab) return;
    active = tab;
    renderTab(active, items);
    if (focus) selector.querySelector(`[data-tab="${CSS.escape(tab.id)}"]`)?.focus();
  }

  selector.addEventListener('click', event => {
    const button = event.target.closest('[role="tab"]');
    if (button) activate(tabs.find(tab => tab.id === button.dataset.tab));
  });

  selector.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0, tabs.findIndex(tab => tab.id === active?.id));
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activate(tabs[index], true);
  });

  function load() {
    return Promise.all([json('config/ai-intelligence.json'), json('data/ai-intelligence.json')])
      .then(([config, intelligence]) => {
        tabs = Array.isArray(config.tabs) ? config.tabs : [];
        items = Array.isArray(intelligence.items) ? intelligence.items : [];
        state.textContent = `${tabs.length} 个 AI Tab · ${items.length} 件已入选事件`;
        selector.innerHTML = tabs.map(tab => `<button type="button" role="tab" id="tab-${escape(tab.id)}" aria-controls="ai-detail" aria-selected="false" tabindex="-1" data-tab="${escape(tab.id)}"><strong>${escape(tab.shortLabel || tab.label)}</strong></button>`).join('');
        if (!tabs.length) {
          detail.innerHTML = '<div class="empty-state"><strong>尚未配置AI板块顶部 Tab</strong><p>请先维护AI板块配置。</p></div>';
          return;
        }
        const query = new URLSearchParams(location.search);
        const requested = query.get('tab');
        const legacyPerson = query.get('person')?.toLowerCase();
        active = tabs.find(tab => tab.id === requested) || tabs.find(tab => tab.handle?.toLowerCase() === legacyPerson) || tabs[0];
        renderTab(active, items);
      })
      .catch(error => {
        state.textContent = 'AI板块读取失败';
        detail.innerHTML = `<div class="empty-state"><strong>无法读取AI板块</strong><p>${escape(error.message)}</p></div>`;
      });
  }

  document.addEventListener('intelbrief:updated', event => { if (event.detail.page === 'ai') load(); });
  load();
})();
