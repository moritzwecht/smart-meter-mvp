import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** URL-sicherer Zufallstoken (256 Bit). */
export function randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
}

/** Tokens werden nur gehasht gespeichert – ein Datenbank-Leak verrät keine gültigen Links. */
export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}
