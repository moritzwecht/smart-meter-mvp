import { authenticateApiRequest } from "@/lib/server/api-tokens";
import { errorResponse, json } from "@/lib/server/http";
import { listMetersForUser } from "@/lib/server/readings-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/meters – alle Zähler des Token-Inhabers inkl. letztem Stand.
 * Praktisch, um in Home Assistant die Zähler-IDs nachzuschlagen.
 */
export async function GET(request: Request) {
    const auth = await authenticateApiRequest(request);
    if (!auth) return errorResponse(401, "Ungültiger oder fehlender API-Token (Authorization: Bearer mh_…).");
    return json({ meters: await listMetersForUser(auth.userId) });
}
