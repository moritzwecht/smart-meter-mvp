"use server";

import { db } from "@/lib/db";
import { users, verificationTokens, households, meters, readings, todoLists, todoItems, notes, householdUsers } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { login as setAuthSession, logout as clearAuthSession, getSession } from "@/lib/auth";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { Resend } from "resend";

const resend = (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_'))
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

async function ensureHouseholdAccess(householdId: number) {
    const session = await getSession();
    if (!session?.email) throw new Error("Unauthorized");

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });
    if (!user) throw new Error("User not found");

    const membership = await db.query.householdUsers.findFirst({
        where: and(
            eq(householdUsers.householdId, householdId),
            eq(householdUsers.userId, user.id)
        )
    });

    if (!membership) throw new Error("Du hast keinen Zugriff auf diesen Haushalt.");
    return { user, membership };
}
export async function getHouseholds() {
    const session = await getSession();
    if (!session?.email) return [];

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });

    if (!user) return [];

    const memberships = await db.query.householdUsers.findMany({
        where: eq(householdUsers.userId, user.id),
        with: {
            household: true
        }
    });

    const sharedHouseholds = memberships.map(m => ({
        ...m.household,
        role: m.role
    }));

    // Also get households where user is the direct owner (legacy/direct entry)
    const ownedHouseholds = await db.query.households.findMany({
        where: eq(households.userId, user.id)
    });

    const owned = ownedHouseholds.map(h => ({ ...h, role: 'OWNER' }));

    // Combine and remove duplicates, priority to OWNER role
    const all = [...sharedHouseholds, ...owned];
    const uniqueMap = new Map();
    all.forEach(h => {
        const existing = uniqueMap.get(h.id);
        if (!existing || h.role === 'OWNER') {
            uniqueMap.set(h.id, h);
        }
    });

    return Array.from(uniqueMap.values());
}

export async function createHousehold(name: string) {
    const session = await getSession();
    if (!session?.email) throw new Error("Unauthorized");

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });

    if (!user) throw new Error("User not found");

    const [newHousehold] = await db.insert(households).values({
        name: name.trim(),
        userId: user.id, // Keeping for backward compatibility/quick ref if needed
    }).returning();

    await db.insert(householdUsers).values({
        householdId: newHousehold.id,
        userId: user.id,
        role: 'OWNER',
    });

    revalidatePath("/");
    return { success: true };
}

export async function deleteHousehold(id: number) {
    const session = await getSession();
    if (!session?.email) throw new Error("Unauthorized");

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });

    if (!user) throw new Error("User not found");

    // Verify current user is owner
    const membership = await db.query.householdUsers.findFirst({
        where: and(
            eq(householdUsers.householdId, id),
            eq(householdUsers.userId, user.id),
            eq(householdUsers.role, 'OWNER')
        )
    });

    if (!membership) throw new Error("Nur der Besitzer kann den Haushalt löschen.");

    // Delete all related data manually since no CASCADE is defined in schema
    // 1. Delete readings for all meters in this household
    const householdMeters = await db.query.meters.findMany({
        where: eq(meters.householdId, id)
    });
    for (const m of householdMeters) {
        await db.delete(readings).where(eq(readings.meterId, m.id));
    }

    // 2. Delete meters
    await db.delete(meters).where(eq(meters.householdId, id));

    // 3. Delete todo items for all lists in this household
    const householdLists = await db.query.todoLists.findMany({
        where: eq(todoLists.householdId, id)
    });
    for (const l of householdLists) {
        await db.delete(todoItems).where(eq(todoItems.listId, l.id));
    }

    // 4. Delete todo lists
    await db.delete(todoLists).where(eq(todoLists.householdId, id));

    // 5. Delete notes
    await db.delete(notes).where(eq(notes.householdId, id));

    // 6. Delete household users
    await db.delete(householdUsers).where(eq(householdUsers.householdId, id));

    // 7. Delete household
    await db.delete(households).where(eq(households.id, id));

    revalidatePath("/");
    return { success: true };
}

export async function updateHousehold(id: number, name: string) {
    const { membership } = await ensureHouseholdAccess(id);
    if (membership.role !== 'OWNER') throw new Error("Nur der Besitzer kann den Haushalt umbenennen.");

    await db.update(households)
        .set({ name: name.trim() })
        .where(eq(households.id, id));
    revalidatePath("/");
    return { success: true };
}

export async function inviteToHousehold(householdId: number, email: string) {
    const session = await getSession();
    if (!session?.email) throw new Error("Unauthorized");

    // Verify current user is owner
    const currentUser = await db.query.users.findFirst({
        where: eq(users.email, session.email as string),
    });
    if (!currentUser) throw new Error("User not found");

    const membership = await db.query.householdUsers.findFirst({
        where: and(
            eq(householdUsers.householdId, householdId),
            eq(householdUsers.userId, currentUser.id),
            eq(householdUsers.role, 'OWNER')
        )
    });

    if (!membership) throw new Error("Nur Besitzer können Mitglieder einladen.");

    // Ensure invited user exists (or create them)
    let invitedUser = await db.query.users.findFirst({
        where: eq(users.email, email.trim())
    });

    if (!invitedUser) {
        // Create a placeholder user record so they can log in later
        const [newUser] = await db.insert(users).values({
            email: email.trim()
        }).returning();
        invitedUser = newUser;
    }

    // Check if already a member
    const existingMembership = await db.query.householdUsers.findFirst({
        where: and(
            eq(householdUsers.householdId, householdId),
            eq(householdUsers.userId, invitedUser.id)
        )
    });

    if (existingMembership) throw new Error("Nutzer ist bereits Mitglied.");

    await db.insert(householdUsers).values({
        householdId,
        userId: invitedUser.id,
        role: 'MEMBER'
    });

    // Send invitation email
    const household = await db.query.households.findFirst({
        where: eq(households.id, householdId)
    });

    if (resend && household) {
        const host = (await headers()).get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;

        try {
            await resend.emails.send({
                from: "My Home <login@home.moritz-wecht.de>",
                to: email.trim(),
                subject: `Einladung zum Haushalt ${household.name}`,
                text: `Hallo,\n\ndu wurdest zum Haushalt "${household.name}" eingeladen.\n\nDu kannst dich hier anmelden: ${baseUrl}\n\nViele Grüße,\nDein My Home Team`,
            });
        } catch (error) {
            console.error("Failed to send invitation email:", error);
        }
    }

    revalidatePath("/");
    return { success: true };
}

export async function removeMember(householdId: number, email: string) {
    const { user, membership } = await ensureHouseholdAccess(householdId);
    if (membership.role !== 'OWNER') throw new Error("Nur Besitzer können Mitglieder entfernen.");

    const userToRemove = await db.query.users.findFirst({
        where: eq(users.email, email.trim())
    });

    if (!userToRemove) throw new Error("Nutzer nicht gefunden.");
    if (userToRemove.id === user.id) throw new Error("Du kannst dich nicht selbst entfernen.");

    await db.delete(householdUsers).where(
        and(
            eq(householdUsers.householdId, householdId),
            eq(householdUsers.userId, userToRemove.id)
        )
    );

    revalidatePath("/");
    return { success: true };
}

export async function getHouseholdMembers(householdId: number) {
    await ensureHouseholdAccess(householdId);
    const members = await db.query.householdUsers.findMany({
        where: eq(householdUsers.householdId, householdId),
        with: {
            user: true
        }
    });
    return members.map(m => ({
        email: m.user.email,
        role: m.role
    }));
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
                from: "My Home <login@home.moritz-wecht.de>",
                to: email,
                subject: "Dein Login-Link für My Home",
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

export async function register(email: string, password: string) {
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email.trim().toLowerCase())
    });

    if (existingUser && existingUser.password) {
        throw new Error("Ein Nutzer mit dieser E-Mail existiert bereits.");
    }

    const hashedPassword = await hash(password, 10);

    const defaultName = email.split('@')[0];

    if (existingUser) {
        // Upgrade existing magic link user to password
        await db.update(users)
            .set({
                password: hashedPassword,
                name: existingUser.name || defaultName
            })
            .where(eq(users.id, existingUser.id));
    } else {
        await db.insert(users).values({
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            name: defaultName
        });
    }

    await setAuthSession(email.trim().toLowerCase());
    revalidatePath("/");
    return { success: true };
}

export async function loginWithPassword(email: string, password: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email.trim().toLowerCase())
    });

    if (!user || !user.password) {
        throw new Error("Ungültige E-Mail oder Passwort.");
    }

    const passwordMatch = await compare(password, user.password);
    if (!passwordMatch) {
        throw new Error("Ungültige E-Mail oder Passwort.");
    }

    await setAuthSession(email.trim().toLowerCase());
    revalidatePath("/");
    return { success: true };
}

export async function updateProfile(data: { name?: string; currentPassword?: string; newPassword?: string }) {
    const session = await getSession();
    if (!session?.email) throw new Error("Nicht autorisiert");

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string)
    });

    if (!user) throw new Error("Benutzer nicht gefunden");

    // If changing password, verify current password
    if (data.newPassword) {
        if (!data.currentPassword) throw new Error("Aktuelles Passwort wird zur Bestätigung benötigt.");
        if (!user.password) throw new Error("Kein Passwort zum Abgleich vorhanden.");

        const isMatch = await compare(data.currentPassword, user.password);
        if (!isMatch) throw new Error("Aktuelles Passwort ist nicht korrekt.");

        const hashedPassword = await hash(data.newPassword, 10);
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, user.id));
    }

    // Update name if provided
    if (data.name) {
        await db.update(users)
            .set({ name: data.name.trim() })
            .where(eq(users.id, user.id));
    }

    revalidatePath("/");
    return { success: true };
}

export async function getUserProfile() {
    const session = await getSession();
    if (!session?.email) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.email, session.email as string)
    });

    if (!user) return null;
    return {
        email: user.email,
        name: user.name || user.email.split('@')[0]
    };
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
    await ensureHouseholdAccess(householdId);
    return await db.query.meters.findMany({
        where: eq(meters.householdId, householdId),
        with: {
            readings: true
        }
    });
}

export async function addMeter(householdId: number, name: string, type: string, unit: string) {
    await ensureHouseholdAccess(householdId);
    await db.insert(meters).values({
        name,
        type,
        unit,
        householdId,
    });
    revalidatePath("/");
}

export async function getTodoLists(householdId: number) {
    await ensureHouseholdAccess(householdId);
    return await db.query.todoLists.findMany({
        where: eq(todoLists.householdId, householdId),
        with: {
            items: true
        }
    });
}

export async function addTodoList(householdId: number, name: string) {
    await ensureHouseholdAccess(householdId);
    await db.insert(todoLists).values({
        name,
        householdId,
    });
    revalidatePath("/");
}

export async function getNotes(householdId: number) {
    await ensureHouseholdAccess(householdId);
    return await db.query.notes.findMany({
        where: eq(notes.householdId, householdId),
    });
}

export async function addNote(householdId: number, title: string, content?: string) {
    await ensureHouseholdAccess(householdId);
    await db.insert(notes).values({
        title,
        content,
        householdId,
    });
    revalidatePath("/");
}

export async function updateNote(id: number, title: string, content?: string) {
    const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
    if (!note) throw new Error("Notiz nicht gefunden");
    await ensureHouseholdAccess(note.householdId);

    await db.update(notes)
        .set({ title, content })
        .where(eq(notes.id, id));
    revalidatePath("/");
}

export async function deleteNote(id: number) {
    const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
    if (!note) return;
    await ensureHouseholdAccess(note.householdId);

    await db.delete(notes).where(eq(notes.id, id));
    revalidatePath("/");
}

export async function updateTodoList(id: number, name: string) {
    const list = await db.query.todoLists.findFirst({ where: eq(todoLists.id, id) });
    if (!list) throw new Error("Liste nicht gefunden");
    await ensureHouseholdAccess(list.householdId);

    await db.update(todoLists)
        .set({ name })
        .where(eq(todoLists.id, id));
    revalidatePath("/");
}

export async function deleteTodoList(id: number) {
    const list = await db.query.todoLists.findFirst({ where: eq(todoLists.id, id) });
    if (!list) return;
    await ensureHouseholdAccess(list.householdId);

    await db.delete(todoLists).where(eq(todoLists.id, id));
    revalidatePath("/");
}

export async function addTodoItem(listId: number, content: string) {
    const list = await db.query.todoLists.findFirst({ where: eq(todoLists.id, listId) });
    if (!list) throw new Error("Liste nicht gefunden");
    await ensureHouseholdAccess(list.householdId);

    await db.insert(todoItems).values({
        listId,
        content,
    });
    revalidatePath("/");
}

export async function toggleTodoItem(id: number, completed: string) {
    const item = await db.query.todoItems.findFirst({
        where: eq(todoItems.id, id),
        with: { list: true }
    });
    if (!item) throw new Error("Punkt nicht gefunden");
    await ensureHouseholdAccess(item.list.householdId);

    await db.update(todoItems)
        .set({ completed })
        .where(eq(todoItems.id, id));
    revalidatePath("/");
}

export async function deleteTodoItem(id: number) {
    const item = await db.query.todoItems.findFirst({
        where: eq(todoItems.id, id),
        with: { list: true }
    });
    if (!item) return;
    await ensureHouseholdAccess(item.list.householdId);

    await db.delete(todoItems).where(eq(todoItems.id, id));
    revalidatePath("/");
}

export async function updateMeter(id: number, name: string, type: string, unit: string) {
    const meter = await db.query.meters.findFirst({ where: eq(meters.id, id) });
    if (!meter) throw new Error("Zähler nicht gefunden");
    await ensureHouseholdAccess(meter.householdId);

    await db.update(meters)
        .set({ name, type, unit })
        .where(eq(meters.id, id));
    revalidatePath("/");
}

export async function deleteMeter(id: number) {
    const meter = await db.query.meters.findFirst({ where: eq(meters.id, id) });
    if (!meter) return;
    await ensureHouseholdAccess(meter.householdId);

    await db.delete(meters).where(eq(meters.id, id));
    revalidatePath("/");
}

export async function addReading(meterId: number, value: string, date: Date) {
    const meter = await db.query.meters.findFirst({ where: eq(meters.id, meterId) });
    if (!meter) throw new Error("Zähler nicht gefunden");
    await ensureHouseholdAccess(meter.householdId);

    // Normalize number format (handle German comma vs English dot)
    let normalized = value.trim().replace(/\s/g, ""); // remove spaces
    if (normalized.includes(",") && normalized.includes(".")) {
        // Assume comma is decimal if both present (e.g. 1.234,56)
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        // Only comma present (e.g. 1234,56)
        normalized = normalized.replace(",", ".");
    }
    // Final check for multiple dots
    const parts = normalized.split(".");
    if (parts.length > 2) {
        normalized = parts.join(""); // something is weird, just strip dots
    }

    await db.insert(readings).values({
        meterId,
        value: normalized,
        date,
    });
    revalidatePath("/");
}

export async function deleteReading(id: number) {
    const reading = await db.query.readings.findFirst({
        where: eq(readings.id, id),
        with: { meter: true }
    });
    if (!reading) return;
    await ensureHouseholdAccess(reading.meter.householdId);

    await db.delete(readings).where(eq(readings.id, id));
    revalidatePath("/");
}
