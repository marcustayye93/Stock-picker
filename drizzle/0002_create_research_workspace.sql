DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  currency TEXT,
  fcf REAL,
  growth_rate REAL,
  terminal_growth REAL,
  discount_rate REAL,
  cash REAL,
  debt REAL,
  shares REAL,
  normalized_eps REAL,
  fair_pe REAL,
  revenue REAL,
  fair_ps REAL,
  revenue_growth REAL,
  eps_growth REAL,
  roic REAL,
  debt_equity REAL,
  fcf_margin REAL,
  interest_coverage REAL,
  share_change REAL,
  margin_trend REAL,
  dcf_value REAL,
  earnings_value REAL,
  sales_value REAL,
  blended_value REAL,
  quality_score REAL,
  quality_complete INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE quote_cache (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  currency TEXT,
  price REAL,
  change REAL,
  change_percent REAL,
  high REAL,
  low REAL,
  week_52_high REAL,
  week_52_low REAL,
  market_cap REAL,
  as_of TEXT,
  source_url TEXT,
  history_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  currency TEXT,
  target_below REAL,
  target_above REAL,
  latest_price REAL,
  price_as_of TEXT,
  source_url TEXT,
  alert_zone TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,
  threshold REAL NOT NULL,
  price REAL NOT NULL,
  triggered_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX analyses_market_idx ON analyses(market);
--> statement-breakpoint
CREATE INDEX alert_events_time_idx ON alert_events(triggered_at DESC);