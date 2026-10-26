-- Anmeldung nur noch per Einmalcode:
-- * Eingabeversuche pro Code werden in der Tabelle gezählt (atomar, auch bei parallelen Anfragen).
-- * Passwort-Hashes werden nicht mehr gebraucht und gelöscht (ein Datenbank-Leak verrät so
--   auch keine alten Passwörter), ebenso offene Links aus "Passwort vergessen".
ALTER TABLE "auth_tokens" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "password";--> statement-breakpoint
DELETE FROM "auth_tokens" WHERE "purpose" = 'RESET';
