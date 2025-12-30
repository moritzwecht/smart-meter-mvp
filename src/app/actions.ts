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

import webpush from "web-push";
import { pushSubscriptions } from "@/lib/db/schema";
import { ne } from "drizzle-orm";

const publicVapidKey = "BBb2t3PWudF0WXr9eKOJ7KG-H6Y014K8aHkbx9ip-wJxt0OPyRzgXzyUXHYHHhW1y6jBMJQQ7e5nAieNhU9pvyo";
const privateVapidKey = "mC6z61cl1kWbg7TSRjhcF6t3H_wExvFoC5LjKoDCqtk";

webpush.setVapidDetails(
    "mailto:example@yourdomain.com",
    publicVapidKey,
    privateVapidKey
);

export async function addReading(meterId: number, value: number, excludeEndpoint?: string) {
    const result = await db.insert(readings).values({
        meterId,
        value,
        date: new Date(),
    }).returning();

    // Notify other devices
    const meter = await db.query.meters.findFirst({
        where: eq(meters.id, meterId)
    });

    if (meter) {
        let query = db.select().from(pushSubscriptions);
        if (excludeEndpoint) {
            // @ts-ignore - ne operator works with drizzle
            query = query.where(ne(pushSubscriptions.endpoint, excludeEndpoint));
        }

        const subscriptions = await query;
        const payload = JSON.stringify({
            title: "Neuer Zählerstand",
            body: `${meter.name}: ${value} ${meter.unit} eingetragen.`,
            icon: "/icon-192.png",
        });

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                }, payload);
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
                }
            }
        }
    }

    revalidatePath("/");
    return result[0];
}

export async function updateMeter(id: number, data: {
    name: string;
    type: "ELECTRICITY" | "GAS" | "WATER";
    unit: string;
    unitPrice?: number;
    monthlyPayment?: number;
}) {
    await db.update(meters).set({
        name: data.name,
        type: data.type,
        unit: data.unit,
        unitPrice: data.unitPrice,
        monthlyPayment: data.monthlyPayment,
    }).where(eq(meters.id, id));

    revalidatePath("/");
}

export async function deleteMeter(id: number) {
    await db.delete(meters).where(eq(meters.id, id));
    revalidatePath("/");
}
