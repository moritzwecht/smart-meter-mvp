"use server";

import { db } from "@/lib/db";
import { users, verificationTokens, households, meters, readings, todoLists, todoItems, notes } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { login as setAuthSession, logout as clearAuthSession, getSession } from "@/lib/auth";
import { randomBytes } from "crypto";
import { Resend } from "resend";

const resend = (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_'))
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
export async function getHouseholds() {
    const session = await getSession();
    if (!session?.email) return [];

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });

    if (!user) return [];

    return await db.query.households.findMany({
        where: eq(households.userId, user.id),
    });
}

export async function createHousehold(name: string) {
    const session = await getSession();
    if (!session?.email) throw new Error("Unauthorized");

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });

    if (!user) throw new Error("User not found");

    await db.insert(households).values({
        name: name.trim(),
        userId: user.id,
    });

    revalidatePath("/");
    return { success: true };
}

export async function requestLogin(email: string) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(verificationTokens).values({
        email,
        token,
        expiresAt,
    });

    const host = (await headers()).get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    const verifyUrl = `${baseUrl}/verify?token=${token}`;

    try {
        if (resend) {
            await resend.emails.send({
                from: "Home by Moritz <onboarding@resend.dev>",
                to: email,
                subject: "Dein Login-Link für Home by Moritz",
                html: `
                    <div>
                        <a href="${verifyUrl}">
                            Jetzt anmelden
                        </a>
                        <p>
                            Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                            ${verifyUrl}
                        </p>
                    </div>
                `,
            });
        } else {
            console.warn("Resend is not initialized. Check RESEND_API_KEY.");
        }
    } catch (error) {
        console.error("Failed to send email:", error);
    }

    // In a real app, send this via email. For now, log to console.
    console.log(`\n\n--- LOGIN LINK FOR ${email} ---`);
    console.log(verifyUrl);
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

// Applications Actions
export async function getMeters(householdId: number) {
    return await db.query.meters.findMany({
        where: eq(meters.householdId, householdId),
        with: {
            readings: true
        }
    });
}

export async function addMeter(householdId: number, name: string, type: string, unit: string) {
    await db.insert(meters).values({
        name,
        type,
        unit,
        householdId,
    });
    revalidatePath("/");
}

export async function getTodoLists(householdId: number) {
    return await db.query.todoLists.findMany({
        where: eq(todoLists.householdId, householdId),
        with: {
            items: true
        }
    });
}

export async function addTodoList(householdId: number, name: string) {
    await db.insert(todoLists).values({
        name,
        householdId,
    });
    revalidatePath("/");
}

export async function getNotes(householdId: number) {
    return await db.query.notes.findMany({
        where: eq(notes.householdId, householdId),
    });
}

export async function addNote(householdId: number, title: string, content?: string) {
    await db.insert(notes).values({
        title,
        content,
        householdId,
    });
    revalidatePath("/");
}

export async function updateNote(id: number, title: string, content?: string) {
    await db.update(notes)
        .set({ title, content })
        .where(eq(notes.id, id));
    revalidatePath("/");
}

export async function deleteNote(id: number) {
    await db.delete(notes).where(eq(notes.id, id));
    revalidatePath("/");
}

export async function updateTodoList(id: number, name: string) {
    await db.update(todoLists)
        .set({ name })
        .where(eq(todoLists.id, id));
    revalidatePath("/");
}

export async function deleteTodoList(id: number) {
    await db.delete(todoLists).where(eq(todoLists.id, id));
    revalidatePath("/");
}

export async function addTodoItem(listId: number, content: string) {
    await db.insert(todoItems).values({
        listId,
        content,
    });
    revalidatePath("/");
}

export async function toggleTodoItem(id: number, completed: string) {
    await db.update(todoItems)
        .set({ completed })
        .where(eq(todoItems.id, id));
    revalidatePath("/");
}

export async function deleteTodoItem(id: number) {
    await db.delete(todoItems).where(eq(todoItems.id, id));
    revalidatePath("/");
}

export async function updateMeter(id: number, name: string, unit: string) {
    await db.update(meters)
        .set({ name, unit })
        .where(eq(meters.id, id));
    revalidatePath("/");
}

export async function deleteMeter(id: number) {
    await db.delete(meters).where(eq(meters.id, id));
    revalidatePath("/");
}

export async function addReading(meterId: number, value: string, date: Date) {
    await db.insert(readings).values({
        meterId,
        value,
        date,
    });
    revalidatePath("/");
}

export async function deleteReading(id: number) {
    await db.delete(readings).where(eq(readings.id, id));
    revalidatePath("/");
}
