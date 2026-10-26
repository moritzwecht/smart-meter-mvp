import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { users } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/sync/types";
import { getDb } from "./db";
import { authSecret, isProduction } from "./env";

/*
 * Sessions
 * --------
 * Signiertes JWT im httpOnly-Cookie, 90 Tage gültig und gleitend verlängert, solange
 * die App genutzt wird. Jede Anfrage prüft den Nutzer in der Datenbank – über
 * `sessionVersion` lassen sich so alle Sessions eines Nutzers sofort beenden
 * (Passwortänderung, "Überall abmelden").
 */

/**
 * In Produktion mit `__Host-`-Präfix: Der Browser akzeptiert das Cookie dann nur
 * von genau dieser Domain (secure, ohne Domain-Attribut) – eine andere Subdomain
 * kann es weder setzen noch überschreiben.
 */
export const SESSION_COOKIE = isProduction ? "__Host-session" : "session";
/** Name aus Version 1 – wird beim nächsten Request umgestellt. */
const LEGACY_COOKIE = "session";
const SESSION_DAYS = 90;
const REFRESH_AFTER_SECONDS = 24 * 60 * 60;

interface SessionClaims {
    sub?: string;
    sv?: number;
    /** Altes Format aus Version 1 */
    email?: string;
    iat?: number;
}

export interface AuthUser extends SessionUser {
    sessionVersion: number;
}

async function sign(userId: number, sessionVersion: number): Promise<string> {
    return new SignJWT({ sv: sessionVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(userId))
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(authSecret());
}

async function verify(token: string): Promise<SessionClaims | null> {
    try {
        const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
        return payload as SessionClaims;
    } catch {
        return null;
    }
}

function cookieOptions() {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax" as const,
        path: "/",
        maxAge: SESSION_DAYS * 24 * 60 * 60,
    };
}

export async function startSession(user: { id: number; sessionVersion: number }) {
    const store = await cookies();
    store.set(SESSION_COOKIE, await sign(user.id, user.sessionVersion), cookieOptions());
    if (LEGACY_COOKIE !== SESSION_COOKIE && store.get(LEGACY_COOKIE)) store.set(LEGACY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function endSession() {
    const store = await cookies();
    store.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    if (LEGACY_COOKIE !== SESSION_COOKIE) store.set(LEGACY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
    return {
        id: row.id,
        email: row.email,
        name: row.name || row.email.split("@")[0],
        hasPassword: !!row.password,
        sessionVersion: row.sessionVersion,
    };
}

/**
 * Liefert den angemeldeten Nutzer oder `null`.
 * Mit `refresh: true` wird das Cookie verlängert (nur dort aufrufen, wo Cookies
 * geschrieben werden dürfen: Route Handler und Server Actions).
 */
export async function getCurrentUser(options: { refresh?: boolean } = {}): Promise<AuthUser | null> {
    const store = await cookies();
    const current = store.get(SESSION_COOKIE)?.value;
    const token = current ?? store.get(LEGACY_COOKIE)?.value;
    if (!token) return null;
    const needsRename = !current;
    const claims = await verify(token);
    if (!claims) return null;

    const db = getDb();
    let row: typeof users.$inferSelect | undefined;
    if (claims.sub) {
        const id = Number(claims.sub);
        if (!Number.isInteger(id)) return null;
        row = await db.query.users.findFirst({ where: eq(users.id, id) });
        if (!row || row.sessionVersion !== claims.sv) return null;
    } else if (claims.email) {
        // Cookie aus Version 1 → einmalig auf das neue Format umstellen
        row = await db.query.users.findFirst({ where: eq(users.email, String(claims.email).toLowerCase()) });
        // Nach "Überall abmelden" / Passwortänderung gilt auch das alte Cookie nicht mehr
        if (!row || row.sessionVersion !== 0) return null;
        if (options.refresh) await startSession(row);
        return toAuthUser(row);
    } else {
        return null;
    }

    const age = Date.now() / 1000 - (claims.iat ?? 0);
    if (options.refresh && (age > REFRESH_AFTER_SECONDS || needsRename)) {
        await startSession(row);
    }
    return toAuthUser(row);
}

export class UnauthorizedError extends Error {
    constructor() {
        super("Nicht angemeldet");
    }
}

export async function requireUser(options: { refresh?: boolean } = {}): Promise<AuthUser> {
    const user = await getCurrentUser(options);
    if (!user) throw new UnauthorizedError();
    return user;
}

export function publicUser(user: AuthUser): SessionUser {
    return { id: user.id, email: user.email, name: user.name, hasPassword: user.hasPassword };
}
