CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(120) NOT NULL DEFAULT 'Imagine Lab CRM',
	`logoUrl` varchar(500),
	`timezone` varchar(60) NOT NULL DEFAULT 'America/Asuncion',
	`language` varchar(10) NOT NULL DEFAULT 'es',
	`currency` varchar(10) NOT NULL DEFAULT 'PYG',
	`permissionsMatrix` json,
	`scheduling` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` MODIFY COLUMN `messageType` enum('text','image','video','audio','document','location','sticker','contact','template') NOT NULL DEFAULT 'text';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('owner','admin','supervisor','agent','viewer') NOT NULL DEFAULT 'agent';--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `errorMessage` text;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `failedAt` timestamp;--> statement-breakpoint
ALTER TABLE `conversations` ADD `assignedToId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;