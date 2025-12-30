import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { endpoint, keys } = await req.json();

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
        }

        await db.insert(pushSubscriptions).values({
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
        }).onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: {
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Push Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
