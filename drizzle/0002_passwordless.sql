-- Anmeldung nur noch per Einmalcode: Passwort-Hashes werden nicht mehr gebraucht
-- und deshalb gelöscht (ein Datenbank-Leak verrät so auch keine alten Passwörter).
ALTER TABLE "users" DROP COLUMN IF EXISTS "password";--> statement-breakpoint
DELETE FROM "auth_tokens" WHERE "purpose" = 'RESET';
