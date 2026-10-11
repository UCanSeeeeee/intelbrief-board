#!/usr/bin/env node
/**
 * Celebrity timeline fetcher
 *
 * Inputs (env — see .env.example):
 *   MODE              placeholder | live  (default: placeholder)
 *   X_BEARER_TOKEN    required only when MODE=live
 *   TZ                IANA timezone for stamps (default Asia/Shanghai)
 *
 * Outputs:
 *   data/celebrities.json  — { updatedAt, mode, feed[], profiles{} }
 *
 * Placeholder mode: refreshes updatedAt on the committed demo JSON (or seeds if missing).
 * Live mode: stub — wire X API here; without a token it falls back to placeholder.
 */
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./load-env");

loadEnv();

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "celebrities.json");
const MODE = (process.env.MODE || "placeholder").toLowerCase();
const TZ = process.env.TZ || "Asia/Shanghai";

function nowIso() {
  // Write a readable offset stamp for Asia/Shanghai by default
  const d = new Date();
  return d.toISOString();
}

function readExisting() {
  if (!fs.existsSync(OUT)) return null;
  return JSON.parse(fs.readFileSync(OUT, "utf8"));
}

async function fetchLive() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.warn("[fetch-celebrities] MODE=live but X_BEARER_TOKEN missing → placeholder");
    return null;
  }
  // Stub: replace with real X API calls for each profile handle.
  // Example shape: GET https://api.x.com/2/users/by/username/:username/tweets
  console.warn("[fetch-celebrities] Live X fetch not wired yet — keeping placeholder data");
  return null;
}

async function main() {
  let data = readExisting();
  if (!data) {
    console.error("[fetch-celebrities] Missing data/celebrities.json — restore from repo");
    process.exit(1);
  }

  if (MODE === "live") {
    const live = await fetchLive();
    if (live) data = live;
  }

  data.mode = MODE === "live" && process.env.X_BEARER_TOKEN ? "live" : "placeholder";
  data.updatedAt = nowIso();
  data.timezone = TZ;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`[fetch-celebrities] wrote ${OUT} (mode=${data.mode})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
