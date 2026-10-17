ALTER TABLE `users` ADD `password_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `look` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tile_x` integer DEFAULT 27 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tile_y` integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;