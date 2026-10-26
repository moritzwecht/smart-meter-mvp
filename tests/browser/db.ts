import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/myhome_e2e" });

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await pool.query(sql, params)).rows as T[];
}

export async function count(table: string, where = "true"): Promise<number> {
    const [row] = await q<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`);
    return row.n;
}

export const closeDb = () => pool.end();
