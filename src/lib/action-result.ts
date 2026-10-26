/**
 * Ergebnis einer Server Action. Erwartbare Fehler werden als Wert zurückgegeben –
 * geworfene Fehler kämen in Produktion nur als generische Meldung beim Client an.
 */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Fehlertext, wenn eine Server Action nach einem Deployment nicht mehr existiert. */
export const OUTDATED_CLIENT_ERROR = "Die App wurde aktualisiert. Bitte lade die Seite neu.";
