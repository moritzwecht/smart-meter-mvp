"use server";

import { db } from "@/lib/db";
import { meters, readings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMeters() {
    const allMeters = await db.query.meters.findMany({
        with: {
            readings: {
                orderBy: [desc(readings.date)],
            }
        }
    });
    return allMeters;
}

export async function addMeter(data: {
    name: string;
    type: "ELECTRICITY" | "GAS" | "WATER";
    unit: string;
    unitPrice?: number;
    monthlyPayment?: number;
}) {
    const result = await db.insert(meters).values({
        name: data.name,
        type: data.type,
        unit: data.unit,
        unitPrice: data.unitPrice,
        monthlyPayment: data.monthlyPayment,
    }).returning();

    revalidatePath("/");
    return result[0];
}

export async function addReading(meterId: number, value: number) {
    const result = await db.insert(readings).values({
        meterId,
        value,
        date: new Date(),
    }).returning();

    revalidatePath("/");
    return result[0];
}

export async function deleteMeter(id: number) {
    await db.delete(meters).where(eq(meters.id, id));
    revalidatePath("/");
}
