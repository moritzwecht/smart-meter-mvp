-- Baseline des Schemas aus Version 1 (bis 01/2026 per `drizzle-kit push` gepflegt).
-- Idempotent: auf einer bestehenden Produktionsdatenbank passiert hier nichts,
-- auf einer leeren Datenbank entsteht das alte Schema, das 0001 dann konvertiert.
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "households" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"household_id" integer NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "is_pinned" text DEFAULT 'false' NOT NULL;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "monthly_payment" text;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "basic_fee" text;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "price_per_unit" text;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "z_number" text;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "calorific_value" text;
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN IF NOT EXISTS "price_unit" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"meter_id" integer NOT NULL,
	"value" text NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "todo_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"household_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_lists" ADD COLUMN IF NOT EXISTS "is_pinned" text DEFAULT 'false' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "todo_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"content" text NOT NULL,
	"completed" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"household_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "is_pinned" text DEFAULT 'false' NOT NULL;
