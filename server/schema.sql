CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL CHECK(page IN ('news','people','tickers','ai','crypto')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK(trigger_type IN ('manual','scheduled')),
  cutoff TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'queued',
  message TEXT NOT NULL DEFAULT '',
  runner_id TEXT,
  lease TEXT,
  lease_until INTEGER,
  result TEXT,
  attempt INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_page ON jobs(page) WHERE status IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS one_running_job ON jobs((1)) WHERE status='running';
CREATE UNIQUE INDEX IF NOT EXISTS one_scheduled_edition ON jobs(cutoff) WHERE trigger_type='scheduled';
CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, job_ids TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS runner (id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_requests (
  id TEXT PRIMARY KEY,
  requested_at TEXT NOT NULL,
  pages TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('dispatching','accepted','unconfirmed','rejected')),
  http_status INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_webhook_dispatching ON webhook_requests((1)) WHERE status='dispatching';
