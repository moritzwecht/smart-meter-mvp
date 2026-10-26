import { getUserHouseholds } from "@/lib/server/access";
import { errorResponse, isSameOrigin, json, parseJson } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/session";
import { applyOps, pullChanges } from "@/lib/server/sync";
import { syncRequestSchema } from "@/lib/sync/schemas";
import type { SyncResponse } from "@/lib/sync/types";

export const dynamic = "force-dynamic";

/**
 * Ein Roundtrip pro Sync: erst die Outbox des Clients anwenden (Push),
 * dann alle Änderungen seit dem Cursor zurückgeben (Pull).
 */
export async function POST(request: Request) {
    if (!isSameOrigin(request)) return errorResponse(403, "Ungültiger Origin");
    const user = await getCurrentUser({ refresh: true });
    if (!user) return errorResponse(401, "Nicht angemeldet");

    const body = await parseJson(request, syncRequestSchema);
    if ("error" in body) return body.error;

    const households = await getUserHouseholds(user.id);
    const ctx = { userId: user.id, householdIds: households.map((h) => h.id) };
    const results = await applyOps(ctx, body.data.ops);
    const since = body.data.since ? new Date(body.data.since) : null;
    const changes = await pullChanges(ctx, households, since);

    return json<SyncResponse>({ results, ...changes });
}
