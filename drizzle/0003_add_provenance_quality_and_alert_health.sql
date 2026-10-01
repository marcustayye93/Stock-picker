ALTER TABLE analyses ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'standard';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN as_of_date TEXT;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN period_label TEXT NOT NULL DEFAULT 'TTM';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN share_basis TEXT NOT NULL DEFAULT 'diluted';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN accounting_basis TEXT NOT NULL DEFAULT 'reported';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN source_label TEXT NOT NULL DEFAULT 'Manual research input';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN source_url TEXT;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN price_at_analysis REAL;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN price_currency TEXT;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN price_as_of TEXT;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN coverage_percent REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN valuation_status TEXT NOT NULL DEFAULT 'insufficient';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN valuation_message TEXT NOT NULL DEFAULT 'Add tagged inputs before calculating.';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN sensitivity_json TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN analysis_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE analysis_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX analysis_versions_symbol_version_idx ON analysis_versions(symbol, version);
--> statement-breakpoint
CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX audit_events_symbol_time_idx ON audit_events(symbol, created_at DESC);
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN provider_symbol TEXT;
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN market_status TEXT;
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN provider_host TEXT;
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN feed_state TEXT NOT NULL DEFAULT 'fresh';
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN adjustment_status TEXT NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
ALTER TABLE quote_cache ADD COLUMN fetched_at INTEGER;
--> statement-breakpoint
UPDATE quote_cache SET fetched_at = updated_at WHERE fetched_at IS NULL;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN split_factor REAL NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN dividend_adjustment REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN adjustment_confirmed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN feed_state TEXT NOT NULL DEFAULT 'stale';
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN last_checked_at INTEGER;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN last_success_at INTEGER;
--> statement-breakpoint
ALTER TABLE watchlist ADD COLUMN last_error TEXT;
--> statement-breakpoint
ALTER TABLE alert_events ADD COLUMN dedupe_key TEXT;
--> statement-breakpoint
UPDATE alert_events SET dedupe_key = symbol || ':' || kind || ':' || id WHERE dedupe_key IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX alert_events_dedupe_key_idx ON alert_events(dedupe_key);
--> statement-breakpoint
ALTER TABLE alert_events ADD COLUMN delivered_at INTEGER;
--> statement-breakpoint
CREATE TABLE alert_health (
  id INTEGER PRIMARY KEY,
  schedule_label TEXT NOT NULL DEFAULT 'Hourly; market sessions only',
  delivery_channel TEXT NOT NULL DEFAULT 'Muse chat',
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  last_error TEXT,
  last_refreshed INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO alert_health (id, schedule_label, delivery_channel, last_refreshed) VALUES (1, 'Hourly; market sessions only', 'Muse chat', 0);
