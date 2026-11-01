CREATE TABLE `accounts` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attemptId` text NOT NULL,
	`questionId` text NOT NULL,
	`userAnswer` text NOT NULL,
	`isCorrect` integer,
	`score` integer NOT NULL,
	`aiFeedback` text,
	FOREIGN KEY (`attemptId`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quizId` text NOT NULL,
	`orderIndex` integer NOT NULL,
	`type` text NOT NULL,
	`questionText` text NOT NULL,
	`options` text,
	`correctAnswer` text NOT NULL,
	`explanation` text NOT NULL,
	FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quizId` text NOT NULL,
	`userId` text NOT NULL,
	`totalScore` integer NOT NULL,
	`mcScore` integer,
	`essayScore` integer,
	`completedAt` integer NOT NULL,
	FOREIGN KEY (`quizId`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`mcCount` integer NOT NULL,
	`essayCount` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
