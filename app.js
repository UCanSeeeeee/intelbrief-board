/* X-only intelligence dashboard. Every dynamic string is escaped before insertion. */
(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatRelative(value) {
    const then = Date.parse(value);
    if (Number.isNaN(then)) return "时间未知";
    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 60) return "刚刚";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} 天前`;
    return new Date(then).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  function formatBeijing(value) {
    if (!value || Number.isNaN(Date.parse(value))) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(value));
  }

  function setActiveNav() {
    const page = document.body.dataset.page || "";
    document.querySelectorAll(".nav a[data-nav]").forEach((link) => {
      const on = link.dataset.nav === page;
      link.classList.toggle("active", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function initMobileNav() {
    const toggle = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    if (!toggle || !sidebar) return;
    const close = () => {
      sidebar.classList.remove("open");
      overlay?.classList.remove("show");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      overlay?.classList.toggle("show", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (open) sidebar.querySelector(".nav a")?.focus();
    });
    overlay?.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar.classList.contains("open")) { close(); toggle.focus(); }
    });
  }

  // Roving keyboard support for every role="tablist" (←/→/Home/End), shared by all pages.
  function initTablistKeys() {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      const tab = event.target.closest?.('[role="tab"]');
      const list = tab?.closest('[role="tablist"]');
      if (!list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      let i = tabs.indexOf(tab);
      i = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (i + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[i].focus();
      tabs[i].click();
    });
  }

  function metricText(metrics = {}) {
    const parts = [];
    if (Number.isFinite(metrics.like_count)) parts.push(`赞 ${metrics.like_count}`);
    if (Number.isFinite(metrics.retweet_count)) parts.push(`转发 ${metrics.retweet_count}`);
    if (Number.isFinite(metrics.reply_count)) parts.push(`回复 ${metrics.reply_count}`);
    return parts.join(" · ");
  }

  function scoreLabel(band) {
    return { high: "高", "medium-high": "中高", medium: "中", low: "低", "very-low": "很低" }[band] || "未评级";
  }

  function renderPost(post) {
    const score = post.credibility || {};
    const warnings = (score.warnings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const reasons = (score.reasons || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const topics = (post.topics || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    const metrics = metricText(post.metrics);
    const b = score.breakdown || {};
    return `
      <article class="x-card">
        <div class="x-card-head">
          <div class="author-block">
            <strong>${escapeHtml(post.author?.name || post.author?.username)}</strong>
            <span>@${escapeHtml(post.author?.username)}</span>
            <span class="category">${escapeHtml(post.category || "uncategorized")}</span>
          </div>
          <div class="score-badge score-${escapeHtml(score.band)}" title="${escapeHtml(score.meaning)}">
            <strong>${escapeHtml(score.overall ?? "—")}</strong><span>${scoreLabel(score.band)}</span>
          </div>
        </div>
        <p class="x-text">${escapeHtml(post.text)}</p>
        ${topics ? `<div class="topic-row">${topics}</div>` : ""}
        <div class="x-meta">
          <time title="北京时间 ${escapeHtml(formatBeijing(post.createdAt))}">${escapeHtml(formatRelative(post.createdAt))}</time>
          ${metrics ? `<span>${escapeHtml(metrics)}</span>` : ""}
          <a href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">查看 X 原帖 ↗</a>
        </div>
        <details class="score-detail">
          <summary>为什么是 ${escapeHtml(score.overall ?? "—")} 分 · 自动初评</summary>
          <div class="score-columns">
            <div>
              <h3>评分构成</h3>
              <dl>
                <div><dt>作者分</dt><dd>${escapeHtml(score.sourceScore ?? "—")}</dd></div>
                <div><dt>主张分</dt><dd>${escapeHtml(score.claimScore ?? "—")}</dd></div>
                <div><dt>直接程度</dt><dd>${escapeHtml(b.directness ?? "—")}/30</dd></div>
                <div><dt>可追溯证据</dt><dd>${escapeHtml(b.traceableEvidence ?? "—")}/25</dd></div>
                <div><dt>独立印证</dt><dd>${escapeHtml(b.independentCorroboration ?? "—")}/25</dd></div>
                <div><dt>具体性</dt><dd>${escapeHtml(b.specificity ?? "—")}/10</dd></div>
              </dl>
            </div>
            <div><h3>加分依据</h3><ul>${reasons || "<li>暂无额外依据</li>"}</ul></div>
            <div><h3>证据缺口</h3><ul>${warnings || "<li>未识别到明显缺口</li>"}</ul></div>
          </div>
          <p class="score-limit">分数衡量可追溯性与当前证据强弱，不等于真伪概率，也不代表股价方向。</p>
        </details>
      </article>`;
  }

  function updateStats(stats = {}) {
    const total = document.getElementById("stat-total");
    const high = document.getElementById("stat-high");
    const medium = document.getElementById("stat-medium");
    const low = document.getElementById("stat-low");
    if (total) total.textContent = stats.total || 0;
    if (high) high.textContent = stats.high || 0;
    if (medium) medium.textContent = (stats.mediumHigh || 0) + (stats.medium || 0);
    if (low) low.textContent = (stats.low || 0) + (stats.veryLow || 0);
  }

  function emptyState(message) {
    return `<div class="empty-state"><strong>暂无真实 X 数据</strong><p>${escapeHtml(message)}</p><p>系统不会用占位新闻填充这里。</p></div>`;
  }

  async function hydrateFeed() {
    const mount = document.getElementById("x-feed");
    if (!mount) return;
    const state = document.getElementById("data-state");
    const updated = document.getElementById("updated-at");
    try {
      const response = await fetch("data/x-intelligence.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let posts = Array.isArray(data.posts) ? data.posts : [];
      const fixedCategory = document.body.dataset.filterCategory;
      if (fixedCategory) posts = posts.filter((post) => post.category === fixedCategory);
      updateStats(data.stats);
      if (state) state.textContent = `${posts.length} 条真实原帖`;
      if (updated) updated.textContent = data.updatedAt ? `构建于 ${formatBeijing(data.updatedAt)} 北京时间` : "尚未构建";

      const render = (category) => {
        const visible = category && category !== "all" ? posts.filter((post) => post.category === category) : posts;
        mount.innerHTML = visible.length
          ? visible.map(renderPost).join("")
          : emptyState(category && category !== "all" ? "当前分类没有已采集原帖。" : "请运行 X API 采集或导入 Grok Bot 的结构化原帖。");
      };
      render("all");
      document.querySelectorAll("#category-filters button").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll("#category-filters button").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");
          render(button.dataset.filter);
        });
      });
    } catch (error) {
      if (state) state.textContent = "数据读取失败";
      mount.innerHTML = emptyState(`读取失败：${error.message}`);
    }
  }

  async function hydrateSources() {
    const mount = document.getElementById("source-registry");
    if (!mount) return;
    try {
      const response = await fetch("sources/x-sources.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      mount.innerHTML = (data.accounts || []).map((source) => `
        <article>
          <div><strong>${escapeHtml(source.displayName)}</strong><span>@${escapeHtml(source.username)}</span></div>
          <p>${escapeHtml(source.category)} · ${escapeHtml(source.sourceClass)} · ${escapeHtml(source.trustTier)}</p>
          <div class="topic-row">${(source.topics || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        </article>`).join("");
    } catch (error) {
      mount.innerHTML = emptyState(`来源表读取失败：${error.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    initTablistKeys();
    initMobileNav();
    hydrateFeed();
    hydrateSources();
  });
})();
