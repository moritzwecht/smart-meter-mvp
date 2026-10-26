import { sql } from "drizzle-orm";
import { householdUsers, households, users } from "@/lib/db/schema";
import { setDbForTesting, type Db } from "@/lib/server/db";
import { getCleanDb } from "./pglite";

/** Frische Testdatenbank mit zwei Haushalten und drei Nutzern. */
export async function setupServer() {
    const { db, client } = await getCleanDb();
    setDbForTesting(db as unknown as Db);

    const [moritz, anna, fremd] = await db
        .insert(users)
        .values([
            { email: "moritz@example.com", name: "Moritz", password: "x" },
            { email: "anna@example.com", name: "Anna", password: "x" },
            { email: "fremd@example.com", name: "Fremd", password: "x" },
        ])
        .returning();
    const [zuhause, fremdHaushalt] = await db
        .insert(households)
        .values([
            { name: "Zuhause", createdBy: moritz.id },
            { name: "Fremd", createdBy: fremd.id },
        ])
        .returning();
    await db.insert(householdUsers).values([
        { householdId: zuhause.id, userId: moritz.id, role: "OWNER" },
        { householdId: zuhause.id, userId: anna.id, role: "MEMBER" },
        { householdId: fremdHaushalt.id, userId: fremd.id, role: "OWNER" },
    ]);

    return {
        db,
        client,
        users: { moritz, anna, fremd },
        households: { zuhause, fremd: fremdHaushalt },
        async count(table: string, where = "true") {
            const res = await client.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`);
            return res.rows[0].n;
        },
        async now() {
            const res = await db.execute(sql`select now() as now`);
            return new Date((res as unknown as { rows: { now: string | Date }[] }).rows[0].now);
        },
    };
}

export type TestServer = Awaited<ReturnType<typeof setupServer>>;
