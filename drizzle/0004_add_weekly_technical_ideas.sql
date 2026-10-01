CREATE TABLE `weekly_idea_runs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `week_key` text NOT NULL,
  `as_of_date` text,
  `status` text NOT NULL DEFAULT 'empty',
  `universe_count` integer NOT NULL DEFAULT 0,
  `quote_count` integer NOT NULL DEFAULT 0,
  `eligible_count` integer NOT NULL DEFAULT 0,
  `match_count` integer NOT NULL DEFAULT 0,
  `error_count` integer NOT NULL DEFAULT 0,
  `note` text,
  `scanned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_idea_runs_week_key_unique` ON `weekly_idea_runs` (`week_key`);
--> statement-breakpoint
CREATE TABLE `weekly_ideas` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer NOT NULL,
  `week_key` text NOT NULL,
  `rank` integer NOT NULL,
  `symbol` text NOT NULL,
  `name` text NOT NULL,
  `close` real NOT NULL,
  `as_of_date` text NOT NULL,
  `prior_52_week_high` real NOT NULL,
  `volume_multiple` real NOT NULL,
  `median_dollar_volume` real NOT NULL,
  `realized_volatility` real NOT NULL,
  `source_url` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `weekly_idea_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_ideas_week_symbol_unique` ON `weekly_ideas` (`week_key`,`symbol`);
--> statement-breakpoint
CREATE INDEX `weekly_ideas_run_rank_idx` ON `weekly_ideas` (`run_id`,`rank`);