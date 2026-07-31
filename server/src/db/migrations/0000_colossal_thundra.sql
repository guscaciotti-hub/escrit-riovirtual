CREATE TABLE `agent_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`meeting_id` text,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`importance` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_memory_agent_idx` ON `agent_memory` (`agent_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`job_title` text NOT NULL,
	`department` text NOT NULL,
	`avatar_config` text DEFAULT '{}' NOT NULL,
	`spawn_x` integer DEFAULT 0 NOT NULL,
	`spawn_y` integer DEFAULT 0 NOT NULL,
	`desk_id` text,
	`persona_system_prompt` text NOT NULL,
	`personality_traits` text DEFAULT '{}' NOT NULL,
	`knowledge_scope` text DEFAULT '' NOT NULL,
	`model` text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agents_org_idx` ON `agents` (`org_id`);--> statement-breakpoint
CREATE TABLE `meeting_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`speaker_type` text NOT NULL,
	`speaker_id` text,
	`speaker_name` text DEFAULT '' NOT NULL,
	`round_number` integer DEFAULT 0 NOT NULL,
	`content` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_messages_meeting_idx` ON `meeting_messages` (`meeting_id`);--> statement-breakpoint
CREATE TABLE `meeting_minutes` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`decisions` text DEFAULT '[]' NOT NULL,
	`action_items` text DEFAULT '[]' NOT NULL,
	`open_questions` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meeting_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`agent_id` text,
	`user_id` text,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meeting_participants_meeting_idx` ON `meeting_participants` (`meeting_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`title` text NOT NULL,
	`agenda` text NOT NULL,
	`room_id` text NOT NULL,
	`mode` text DEFAULT 'debate' NOT NULL,
	`duration_minutes` integer,
	`max_rounds` integer DEFAULT 6 NOT NULL,
	`max_tokens` integer DEFAULT 60000 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`started_at` text,
	`finished_at` text,
	`token_cost_estimate` integer DEFAULT 0 NOT NULL,
	`token_cost_actual` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meetings_org_idx` ON `meetings` (`org_id`);--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_slug_unique` ON `orgs` (`slug`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bounds` text DEFAULT '{}' NOT NULL,
	`capacity` integer DEFAULT 8 NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_org_idx` ON `rooms` (`org_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`avatar_config` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`org_id`);