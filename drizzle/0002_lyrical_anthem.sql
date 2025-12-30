ALTER TABLE "households" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "household_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "household_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "meter_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "todo_items" ALTER COLUMN "list_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "todo_lists" ALTER COLUMN "household_id" SET DATA TYPE integer;