ALTER TABLE `weekly_ideas` ADD `setup` text NOT NULL DEFAULT 'breakout';
--> statement-breakpoint
ALTER TABLE `weekly_ideas` ADD `setup_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `weekly_ideas` ADD `benchmark_json` text;
