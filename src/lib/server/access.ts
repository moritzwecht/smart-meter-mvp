import "server-only";
import { and, eq } from "drizzle-orm";
import { households, householdUsers } from "@/lib/db/schema";
import type { Household, Role } from "@/lib/sync/types";
import { getDb } from "./db";

export async function getUserHouseholds(userId: number): Promise<Household[]> {
    const rows = await getDb()
        .select({ id: households.id, name: households.name, role: householdUsers.role })
        .from(householdUsers)
        .innerJoin(households, eq(households.id, householdUsers.householdId))
        .where(eq(householdUsers.userId, userId))
        .orderBy(households.createdAt);
    return rows.map((r) => ({ id: r.id, name: r.name, role: r.role as Role }));
}

export async function getMembership(userId: number, householdId: number) {
    return getDb().query.householdUsers.findFirst({
        where: and(eq(householdUsers.userId, userId), eq(householdUsers.householdId, householdId)),
    });
}

export class ForbiddenError extends Error {}

export async function requireMembership(userId: number, householdId: number) {
    const membership = await getMembership(userId, householdId);
    if (!membership) throw new ForbiddenError("Du hast keinen Zugriff auf diesen Haushalt.");
    return membership;
}

export async function requireOwner(userId: number, householdId: number) {
    const membership = await requireMembership(userId, householdId);
    if (membership.role !== "OWNER") throw new ForbiddenError("Nur Inhaber können das.");
    return membership;
}
