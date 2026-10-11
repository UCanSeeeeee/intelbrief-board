/* Intel Brief — shared UI + JSON data hydration (portable, no build step) */
(function () {
  function dataUrl(name) {
    // Resolve data/*.json relative to site root from any page depth
    const depth = (location.pathname.match(/\//g) || []).length;
    // Heuristic: if path contains /celebrity/, go up one level
    if (/\/celebrity\//.test(location.pathname) || /\/celebrity$/.test(location.pathname.replace(/\/$/, ""))) {
      return "../data/" + name;
    }
    return "data/" + name;
  }

  function formatRelative(date) {
    const now = Date.now();
    const then = date.getTime();
    const sec = Math.round((now - then) / 1000);
    if (sec < 60) return "刚刚";
    const min = Math.round(sec / 60);
    if (min < 60) return min + " 分钟前";
    const hr = Math.round(min / 60);
    if (hr < 24) return hr + " 小时前";
    const day = Math.round(hr / 24);
    if (day < 7) return day + " 天前";
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  function refreshRelativeTimes() {
    document.querySelectorAll("[data-ts]").forEach(function (el) {
      const raw = el.getAttribute("data-ts");
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        el.textContent = formatRelative(d);
        el.title = d.toLocaleString("zh-CN", { hour12: false });
      }
    });
  }

  function setActiveNav() {
    const page = document.body.getAttribute("data-page") || "";
    document.querySelectorAll(".nav a[data-nav]").forEach(function (a) {
      const key = a.getAttribute("data-nav");
      if (key === page) a.classList.add("active");
      else a.classList.remove("active");
    });
  }

  function initMobileNav() {
    const toggle = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    if (!toggle || !sidebar) return;
    function close() {
      sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("show");
    }
    function open() {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.add("show");
    }
    toggle.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) close();
      else open();
    });
    if (overlay) overlay.addEventListener("click", close);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function profileHref(slug) {
    if (/\/celebrity\//.test(location.pathname)) return slug + ".html";
    return "celebrity/" + slug + ".html";
  }

  function renderCelebFeed(feed, mount) {
    if (!mount || !feed || !feed.length) return;
    const prefix = /\/celebrity\//.test(location.pathname) ? "" : "celebrity/";
    mount.innerHTML = feed
      .slice()
      .sort(function (a, b) {
        return new Date(b.ts) - new Date(a.ts);
      })
      .map(function (item) {
        return (
          '<li><a class="feed-item" href="' +
          prefix +
          escapeHtml(item.slug) +
          '.html">' +
          '<div class="avatar">' +
          escapeHtml(item.avatar) +
          "</div>" +
          '<div class="feed-body">' +
          '<div class="feed-name">' +
          escapeHtml(item.name) +
          "</div>" +
          '<div class="feed-update">' +
          escapeHtml(item.update) +
          "</div>" +
          "</div>" +
          '<time class="feed-time" data-ts="' +
          escapeHtml(item.ts) +
          '">—</time>' +
          "</a></li>"
        );
      })
      .join("");
  }

  function renderCheckpoints(data, mount, useFullLabels) {
    if (!mount || !data || !data.checkpoints) return;
    mount.innerHTML = data.checkpoints
      .map(function (cp) {
        const items = (cp.items || [])
          .map(function (it) {
            const cls = it.tagClass ? " " + it.tagClass : "";
            return (
              '<li class="intel-item"><span class="tag' +
              cls +
              '">' +
              escapeHtml(it.tag) +
              "</span> " +
              escapeHtml(it.text) +
              "</li>"
            );
          })
          .join("");
        const label = useFullLabels ? cp.labelFull || cp.label : cp.label;
        const time = useFullLabels ? cp.timeHintFull || cp.timeHint : cp.timeHint;
        const statusCls = cp.status === "done" ? "done" : "pending";
        const statusText = cp.status === "done" ? "已汇总" : "待更新";
        return (
          '<div class="checkpoint">' +
          '<div class="checkpoint-head">' +
          '<span class="checkpoint-label">' +
          escapeHtml(label) +
          "</span>" +
          '<span class="checkpoint-time">' +
          escapeHtml(time) +
          "</span>" +
          '<span class="checkpoint-status ' +
          statusCls +
          '">' +
          statusText +
          "</span>" +
          "</div>" +
          '<ul class="intel-list">' +
          items +
          "</ul>" +
          '<div class="watchlist-note">' +
          (cp.watchlistNote || "") +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderOtherCelebs(profiles, currentSlug, mount) {
    if (!mount || !profiles) return;
    const cards = Object.keys(profiles)
      .filter(function (slug) {
        return slug !== currentSlug;
      })
      .map(function (slug) {
        const p = profiles[slug];
        return (
          '<a class="celeb-card" href="' +
          escapeHtml(slug) +
          '.html">' +
          '<div class="avatar">' +
          escapeHtml(p.avatar) +
          "</div>" +
          "<div><div class=\"name\">" +
          escapeHtml(p.name) +
          '</div><div class="role">' +
          escapeHtml((p.role || "").split("·")[0].trim()) +
          "</div></div></a>"
        );
      });
    mount.innerHTML = cards.join("");
  }

  function hydrateFromJson() {
    const homeFeed = document.getElementById("home-celeb-feed");
    const celebFeed = document.getElementById("celeb-feed");
    const homeStocks = document.getElementById("home-stock-checkpoints");
    const stocksMount = document.getElementById("stock-checkpoints");
    const watchlistMount = document.getElementById("watchlist-bar");
    const otherMount = document.getElementById("other-celebs");

    const needsCelebs = homeFeed || celebFeed || otherMount;
    const needsStocks = homeStocks || stocksMount || watchlistMount;

    const tasks = [];

    if (needsCelebs) {
      tasks.push(
        fetch(dataUrl("celebrities.json"))
          .then(function (r) {
            if (!r.ok) throw new Error("celebrities.json " + r.status);
            return r.json();
          })
          .then(function (data) {
            if (homeFeed) renderCelebFeed(data.feed, homeFeed);
            if (celebFeed) renderCelebFeed(data.feed, celebFeed);
            if (otherMount && data.profiles) {
              const m = location.pathname.match(/\/([^/]+)\.html$/);
              const slug = m ? m[1] : "";
              renderOtherCelebs(data.profiles, slug, otherMount);
            }
            refreshRelativeTimes();
          })
          .catch(function (err) {
            console.warn("[brief] celebrities hydrate skipped:", err.message);
          })
      );
    }

    if (needsStocks) {
      tasks.push(
        fetch(dataUrl("stock-sessions.json"))
          .then(function (r) {
            if (!r.ok) throw new Error("stock-sessions.json " + r.status);
            return r.json();
          })
          .then(function (data) {
            if (homeStocks) renderCheckpoints(data, homeStocks, false);
            if (stocksMount) renderCheckpoints(data, stocksMount, true);
            if (watchlistMount && data.watchlist) {
              watchlistMount.innerHTML =
                "当前自选：" +
                data.watchlist
                  .map(function (t) {
                    return '<strong style="color: var(--text);">' + escapeHtml(t) + "</strong>";
                  })
                  .join("、") +
                '<br /><span style="font-size: 12px; color: var(--text-muted);">后续可在 .env 的 WATCHLIST 中添加；重新运行 npm run fetch:stocks。</span>';
            }
            const metaDay = document.getElementById("trading-day-label");
            if (metaDay && data.tradingDayLabel) metaDay.textContent = data.tradingDayLabel;
          })
          .catch(function (err) {
            console.warn("[brief] stock hydrate skipped:", err.message);
          })
      );
    }

    return Promise.all(tasks);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveNav();
    refreshRelativeTimes();
    initMobileNav();
    hydrateFromJson().then(function () {
      refreshRelativeTimes();
    });
    setInterval(refreshRelativeTimes, 60000);
  });
})();
