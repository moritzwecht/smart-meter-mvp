import { db } from "@/lib/db";
import { meters, readings, pushSubscriptions } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import webpush from "web-push";

// VAPID keys should ideally be in environment variables
const publicVapidKey = "BBb2t3PWudF0WXr9eKOJ7KG-H6Y014K8aHkbx9ip-wJxt0OPyRzgXzyUXHYHHhW1y6jBMJQQ7e5nAieNhU9pvyo";
const privateVapidKey = "mC6z61cl1kWbg7TSRjhcF6t3H_wExvFoC5LjKoDCqtk";

webpush.setVapidDetails(
    "mailto:example@yourdomain.com",
    publicVapidKey,
    privateVapidKey
);

export async function GET(req: Request) {
    try {
        // Fetch all meters
        const allMeters = await db.select().from(meters);
        const subscriptions = await db.select().from(pushSubscriptions);

        if (subscriptions.length === 0) {
            return NextResponse.json({ message: "No subscriptions found" });
        }

        const notificationsSent = [];

        for (const meter of allMeters) {
            // Get last reading for this meter
            const lastReading = await db.select()
                .from(readings)
                .where(eq(readings.meterId, meter.id))
                .orderBy(desc(readings.date))
                .limit(1);

            const lastDate = lastReading.length > 0 ? new Date(lastReading[0].date) : new Date(meter.createdAt);
            const diffInDays = (new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24);

            if (diffInDays > 10) {
                // Send notification to all subscribers
                const payload = JSON.stringify({
                    title: "Zähler-Check fällig!",
                    body: `Dein Zähler "${meter.name}" ist schon länger nicht gescannt worden.`,
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
                        notificationsSent.push(meter.name);
                    } catch (error: any) {
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            // Subscription expired or no longer valid
                            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
                        }
                        console.error("Error sending push:", error);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            notificationsSent,
            message: notificationsSent.length > 0 ? `Sent ${notificationsSent.length} notifications` : "No notifications needed"
        });
    } catch (error) {
        console.error("Check Readings Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
