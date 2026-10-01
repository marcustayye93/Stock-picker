ALTER TABLE `weekly_idea_runs` ADD `earnings_checked_at` integer;
--> statement-breakpoint
ALTER TABLE `weekly_idea_runs` ADD `earnings_checked_through` text;
--> statement-breakpoint
ALTER TABLE `weekly_idea_runs` ADD `earnings_excluded_count` integer NOT NULL DEFAULT 0;
