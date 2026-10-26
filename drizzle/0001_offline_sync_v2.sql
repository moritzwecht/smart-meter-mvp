-- Version 2: Offline-Sync mit Client-UUIDs, echte Datentypen, Soft-Delete,
-- Einladungen/Passwort-Reset per Token, API-Tokens und Push-Abos.
--
-- Läuft (wie alle Migrationen über `npm run db:migrate`) in EINER Transaktion:
-- schlägt etwas fehl, bleibt die Datenbank unverändert.
-- Vorher wird jede alte Tabelle ins Schema `v1_backup` kopiert (löschbar mit
-- `DROP SCHEMA v1_backup CASCADE;`, sobald alles läuft).
--
-- Zeitstempel: `created_at` stammt immer aus `DEFAULT now()` und ist daher in der
-- Zeitzone der Datenbank gespeichert (Cast). `readings.date` hat die App als UTC
-- geschrieben (Drizzle → toISOString) und wird deshalb als UTC interpretiert.

-- 1) Sicherungskopien ---------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "v1_backup";
--> statement-breakpoint
CREATE TABLE "v1_backup"."users" AS TABLE "public"."users";
--> statement-breakpoint
CREATE TABLE "v1_backup"."households" AS TABLE "public"."households";
--> statement-breakpoint
CREATE TABLE "v1_backup"."household_users" AS TABLE "public"."household_users";
--> statement-breakpoint
CREATE TABLE "v1_backup"."meters" AS TABLE "public"."meters";
--> statement-breakpoint
CREATE TABLE "v1_backup"."readings" AS TABLE "public"."readings";
--> statement-breakpoint
CREATE TABLE "v1_backup"."todo_lists" AS TABLE "public"."todo_lists";
--> statement-breakpoint
CREATE TABLE "v1_backup"."todo_items" AS TABLE "public"."todo_items";
--> statement-breakpoint
CREATE TABLE "v1_backup"."notes" AS TABLE "public"."notes";
--> statement-breakpoint

-- 2) Hilfsfunktion: Zahl aus Text ("1.234,56", "0,32 €", "12.5") ---------------
CREATE OR REPLACE FUNCTION "__v1_parse_decimal"(v text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    s text;
    last_comma int;
    last_dot int;
BEGIN
    IF v IS NULL THEN
        RETURN NULL;
    END IF;
    s := regexp_replace(v, '[[:space:]€]', '', 'g');
    IF s = '' THEN
        RETURN NULL;
    END IF;
    last_comma := CASE WHEN strpos(s, ',') > 0 THEN length(s) - strpos(reverse(s), ',') + 1 ELSE 0 END;
    last_dot := CASE WHEN strpos(s, '.') > 0 THEN length(s) - strpos(reverse(s), '.') + 1 ELSE 0 END;
    IF last_comma > 0 AND last_dot > 0 THEN
        IF last_comma > last_dot THEN
            s := replace(replace(s, '.', ''), ',', '.');   -- 1.234,56
        ELSE
            s := replace(s, ',', '');                      -- 1,234.56
        END IF;
    ELSIF last_comma > 0 THEN
        IF length(s) - length(replace(s, ',', '')) > 1 THEN
            s := replace(s, ',', '');                      -- 1,234,567
        ELSE
            s := replace(s, ',', '.');                     -- 0,32
        END IF;
    ELSIF length(s) - length(replace(s, '.', '')) > 1 THEN
        s := replace(s, '.', '');                          -- 1.234.567
    END IF;
    IF s ~ '^-?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN
        RETURN s::numeric;
    END IF;
    RETURN NULL;
END;
$$;
--> statement-breakpoint

-- 3) Alle Fremdschlüssel lösen (werden unten sauber neu angelegt) -------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'f'
          AND conrelid IN ('households'::regclass, 'household_users'::regclass, 'meters'::regclass,
                           'readings'::regclass, 'todo_lists'::regclass, 'todo_items'::regclass, 'notes'::regclass)
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "household_users_household_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "household_users_user_household_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "readings_meter_id_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "readings_date_idx";
--> statement-breakpoint

-- 4) Nutzer: E-Mails normalisieren, Dubletten (Groß-/Kleinschreibung) zusammenführen
CREATE TABLE "__v1_user_merge" AS
SELECT u.id AS old_id, k.keep_id
FROM "users" u
JOIN (
    SELECT DISTINCT ON (lower(trim(email))) lower(trim(email)) AS norm, id AS keep_id
    FROM "users"
    ORDER BY lower(trim(email)), (password IS NULL), id
) k ON k.norm = lower(trim(u.email))
WHERE u.id <> k.keep_id;
--> statement-breakpoint
UPDATE "household_users" hu SET "user_id" = m.keep_id FROM "__v1_user_merge" m WHERE hu."user_id" = m.old_id;
--> statement-breakpoint
UPDATE "households" h SET "user_id" = m.keep_id FROM "__v1_user_merge" m WHERE h."user_id" = m.old_id;
--> statement-breakpoint
DELETE FROM "users" WHERE "id" IN (SELECT old_id FROM "__v1_user_merge");
--> statement-breakpoint
DROP TABLE "__v1_user_merge";
--> statement-breakpoint
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reminder_day" integer;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamp with time zone;
--> statement-breakpoint

-- 5) Haushalte & Mitgliedschaften --------------------------------------------
DELETE FROM "household_users" WHERE "household_id" NOT IN (SELECT "id" FROM "households")
    OR "user_id" NOT IN (SELECT "id" FROM "users");
--> statement-breakpoint
-- Inhaber aus households.user_id als Mitgliedschaft sicherstellen (früher "direkter Besitz")
INSERT INTO "household_users" ("household_id", "user_id", "role")
SELECT h."id", h."user_id", 'OWNER'
FROM "households" h
WHERE h."user_id" IN (SELECT "id" FROM "users")
  AND NOT EXISTS (SELECT 1 FROM "household_users" hu WHERE hu."household_id" = h."id" AND hu."user_id" = h."user_id");
--> statement-breakpoint
UPDATE "household_users" hu SET "role" = 'OWNER'
FROM "households" h
WHERE hu."household_id" = h."id" AND hu."user_id" = h."user_id" AND hu."role" <> 'OWNER';
--> statement-breakpoint
DELETE FROM "household_users" a USING "household_users" b
WHERE a."household_id" = b."household_id" AND a."user_id" = b."user_id" AND a."id" <> b."id"
  AND (CASE WHEN a."role" = 'OWNER' THEN 0 ELSE 1 END, a."id") > (CASE WHEN b."role" = 'OWNER' THEN 0 ELSE 1 END, b."id");
--> statement-breakpoint
ALTER TABLE "household_users" ALTER COLUMN "household_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "household_users" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "households" RENAME COLUMN "user_id" TO "created_by";
--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "created_by" DROP NOT NULL;
--> statement-breakpoint
UPDATE "households" SET "created_by" = NULL WHERE "created_by" NOT IN (SELECT "id" FROM "users");
--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamp with time zone;
--> statement-breakpoint

-- 6) Verwaiste Datensätze entfernen (liegen in den Sicherungskopien) ----------
DELETE FROM "meters" WHERE "household_id" NOT IN (SELECT "id" FROM "households");
--> statement-breakpoint
DELETE FROM "todo_lists" WHERE "household_id" NOT IN (SELECT "id" FROM "households");
--> statement-breakpoint
DELETE FROM "notes" WHERE "household_id" NOT IN (SELECT "id" FROM "households");
--> statement-breakpoint

-- 7) UUIDs für alle offline anlegbaren Datensätze ---------------------------
ALTER TABLE "meters" ADD COLUMN "uid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "todo_lists" ADD COLUMN "uid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "uid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "uid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "meter_uid" uuid;
--> statement-breakpoint
UPDATE "readings" r SET "meter_uid" = m."uid" FROM "meters" m WHERE m."id" = r."meter_id";
--> statement-breakpoint
DELETE FROM "readings" WHERE "meter_uid" IS NULL OR "__v1_parse_decimal"("value") IS NULL;
--> statement-breakpoint
ALTER TABLE "todo_items" ADD COLUMN "uid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "todo_items" ADD COLUMN "list_uid" uuid;
--> statement-breakpoint
UPDATE "todo_items" i SET "list_uid" = l."uid" FROM "todo_lists" l WHERE l."id" = i."list_id";
--> statement-breakpoint
DELETE FROM "todo_items" WHERE "list_uid" IS NULL;
--> statement-breakpoint
ALTER TABLE "readings" DROP COLUMN "meter_id";
--> statement-breakpoint
ALTER TABLE "readings" RENAME COLUMN "meter_uid" TO "meter_id";
--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "meter_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "todo_items" DROP COLUMN "list_id";
--> statement-breakpoint
ALTER TABLE "todo_items" RENAME COLUMN "list_uid" TO "list_id";
--> statement-breakpoint
ALTER TABLE "todo_items" ALTER COLUMN "list_id" SET NOT NULL;
--> statement-breakpoint
DO $$
DECLARE
    t text;
    pk text;
BEGIN
    FOREACH t IN ARRAY ARRAY['meters', 'readings', 'todo_lists', 'todo_items', 'notes']
    LOOP
        SELECT conname INTO pk FROM pg_constraint WHERE conrelid = t::regclass AND contype = 'p';
        IF pk IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, pk);
        END IF;
        EXECUTE format('ALTER TABLE %I RENAME COLUMN "id" TO "legacy_id"', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN "legacy_id" DROP DEFAULT', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN "legacy_id" DROP NOT NULL', t);
        EXECUTE format('DROP SEQUENCE IF EXISTS %I', t || '_id_seq');
        EXECUTE format('ALTER TABLE %I RENAME COLUMN "uid" TO "id"', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN "id" DROP DEFAULT', t);
        EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY ("id")', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at"::timestamp with time zone', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN "deleted_at" timestamp with time zone', t);
    END LOOP;
END $$;
--> statement-breakpoint

-- 8) Echte Datentypen statt Text --------------------------------------------
ALTER TABLE "meters" ALTER COLUMN "household_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "is_pinned" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "is_pinned" TYPE boolean USING (lower(trim("is_pinned")) = 'true');
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "is_pinned" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "monthly_payment" TYPE numeric(12, 2) USING (CASE WHEN abs("__v1_parse_decimal"("monthly_payment")) < 1e9 THEN "__v1_parse_decimal"("monthly_payment") END);
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "basic_fee" TYPE numeric(12, 2) USING (CASE WHEN abs("__v1_parse_decimal"("basic_fee")) < 1e9 THEN "__v1_parse_decimal"("basic_fee") END);
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "price_per_unit" TYPE numeric(12, 6) USING (CASE WHEN abs("__v1_parse_decimal"("price_per_unit")) < 1e5 THEN "__v1_parse_decimal"("price_per_unit") END);
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "z_number" TYPE numeric(10, 6) USING (CASE WHEN abs("__v1_parse_decimal"("z_number")) < 1e3 THEN "__v1_parse_decimal"("z_number") END);
--> statement-breakpoint
ALTER TABLE "meters" ALTER COLUMN "calorific_value" TYPE numeric(10, 6) USING (CASE WHEN abs("__v1_parse_decimal"("calorific_value")) < 1e3 THEN "__v1_parse_decimal"("calorific_value") END);
--> statement-breakpoint
UPDATE "meters" SET "price_unit" = 'kwh' WHERE lower("price_unit") = 'kwh';
--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN "billing_start" date;
--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "value" TYPE numeric(16, 4) USING "__v1_parse_decimal"("value");
--> statement-breakpoint
ALTER TABLE "readings" ALTER COLUMN "date" TYPE timestamp with time zone USING "date" AT TIME ZONE 'UTC';
--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "is_replacement" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "source" text DEFAULT 'app' NOT NULL;
--> statement-breakpoint
ALTER TABLE "todo_lists" ALTER COLUMN "household_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "todo_lists" ALTER COLUMN "is_pinned" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "todo_lists" ALTER COLUMN "is_pinned" TYPE boolean USING (lower(trim("is_pinned")) = 'true');
--> statement-breakpoint
ALTER TABLE "todo_lists" ALTER COLUMN "is_pinned" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "todo_items" ALTER COLUMN "completed" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "todo_items" ALTER COLUMN "completed" TYPE boolean USING (lower(trim("completed")) = 'true');
--> statement-breakpoint
ALTER TABLE "todo_items" ALTER COLUMN "completed" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "household_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "is_pinned" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "is_pinned" TYPE boolean USING (lower(trim("is_pinned")) = 'true');
--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "is_pinned" SET DEFAULT false;
--> statement-breakpoint
DROP FUNCTION "__v1_parse_decimal"(text);
--> statement-breakpoint

-- 9) updated_at automatisch pflegen (auch bei Änderungen außerhalb der App) --
CREATE OR REPLACE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "meters_set_updated_at" BEFORE UPDATE ON "meters" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "readings_set_updated_at" BEFORE UPDATE ON "readings" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "todo_lists_set_updated_at" BEFORE UPDATE ON "todo_lists" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "todo_items_set_updated_at" BEFORE UPDATE ON "todo_items" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "notes_set_updated_at" BEFORE UPDATE ON "notes" FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
--> statement-breakpoint

-- 10) Neue Tabellen -----------------------------------------------------------
DROP TABLE IF EXISTS "verification_tokens";
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"household_id" integer,
	"created_by" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint

-- 11) Fremdschlüssel & Indizes ------------------------------------------------
ALTER TABLE "households" ADD CONSTRAINT "households_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "todo_items" ADD CONSTRAINT "todo_items_list_id_todo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "household_users_household_user_uq" ON "household_users" USING btree ("household_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_users_user_id_idx" ON "household_users" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meters_household_id_idx" ON "meters" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "meters_updated_at_idx" ON "meters" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "readings_meter_date_idx" ON "readings" USING btree ("meter_id","date");
--> statement-breakpoint
CREATE INDEX "readings_updated_at_idx" ON "readings" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "todo_lists_household_id_idx" ON "todo_lists" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "todo_lists_updated_at_idx" ON "todo_lists" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "todo_items_list_id_idx" ON "todo_items" USING btree ("list_id");
--> statement-breakpoint
CREATE INDEX "todo_items_updated_at_idx" ON "todo_items" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_household_id_idx" ON "notes" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "notes_updated_at_idx" ON "notes" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "auth_tokens_email_idx" ON "auth_tokens" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "auth_tokens_household_idx" ON "auth_tokens" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "auth_attempts_key_created_idx" ON "auth_attempts" USING btree ("key","created_at");
--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");
