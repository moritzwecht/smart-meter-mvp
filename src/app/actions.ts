"use server";

import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { login as setAuthSession, logout as clearAuthSession } from "@/lib/auth";
import { randomBytes } from "crypto";

export async function requestLogin(email: string) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(verificationTokens).values({
        email,
        token,
        expiresAt,
    });

    // In a real app, send this via email. For now, log to console.
    console.log(`\n\n--- LOGIN LINK FOR ${email} ---`);
    console.log(`http://localhost:3000/verify?token=${token}`);
    console.log("---------------------------------\n\n");

    return { success: true };
}

export async function verifyLogin(token: string) {
    const [record] = await db
        .select()
        .from(verificationTokens)
        .where(
            and(
                eq(verificationTokens.token, token),
                gt(verificationTokens.expiresAt, new Date())
            )
        );

    if (!record) {
        throw new Error("Invalid or expired token");
    }

    // Upsert user
    const [existingUser] = await db.select().from(users).where(eq(users.email, record.email));

    if (!existingUser) {
        await db.insert(users).values({ email: record.email });
    }

    // Set session
    await setAuthSession(record.email);

    // Clean up used token
    await db.delete(verificationTokens).where(eq(verificationTokens.id, record.id));

    revalidatePath("/");
    return { success: true };
}

export async function logout() {
    await clearAuthSession();
    revalidatePath("/");
}
