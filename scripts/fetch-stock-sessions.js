#!/usr/bin/env node
/**
 * US stock three-session intel fetcher
 *
 * Checkpoints: night-close (夜盘结束) | pre-market (盘前) | pre-open (开盘前)
 * Not a price ticker — news/intel digests only.
 *
 * Inputs (env — see .env.example):
 *   MODE                 placeholder | live
 *   STOCK_NEWS_API_KEY   required only when MODE=live
 *   STOCK_NEWS_API_BASE  API base URL
 *   WATCHLIST            comma-separated tickers (default NVDA,TSLA,AAPL,MSFT,META)
 *   TZ                   IANA timezone
 *
 * Outputs:
 *   data/stock-sessions.json
 */
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./load-env");

loadEnv();

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "stock-sessions.json");
const MODE = (process.env.MODE || "placeholder").toLowerCase();
const TZ = process.env.TZ || "Asia/Shanghai";
const WATCHLIST = (process.env.WATCHLIST || "NVDA,TSLA,AAPL,MSFT,META")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function nowIso() {
  return new Date().toISOString();
}

function readExisting() {
  if (!fs.existsSync(OUT)) return null;
  return JSON.parse(fs.readFileSync(OUT, "utf8"));
}

async function fetchLive(existing) {
  const key = process.env.STOCK_NEWS_API_KEY;
  const base = process.env.STOCK_NEWS_API_BASE;
  if (!key || !base) {
    console.warn("[fetch-stock-sessions] MODE=live but API key/base missing → placeholder");
    return null;
  }
  // Stub: for each watchlist symbol, GET news and fold into checkpoint items.
  console.warn("[fetch-stock-sessions] Live news fetch not wired yet — keeping placeholder data");
  return null;
}

async function main() {
  let data = readExisting();
  if (!data) {
    console.error("[fetch-stock-sessions] Missing data/stock-sessions.json — restore from repo");
    process.exit(1);
  }

  data.watchlist = WATCHLIST;

  if (MODE === "live") {
    const live = await fetchLive(data);
    if (live) data = live;
  }

  data.mode =
    MODE === "live" && process.env.STOCK_NEWS_API_KEY ? "live" : "placeholder";
  data.updatedAt = nowIso();
  data.timezone = TZ;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`[fetch-stock-sessions] wrote ${OUT} (mode=${data.mode}, watchlist=${WATCHLIST.join(",")})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
