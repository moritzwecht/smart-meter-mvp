import { z } from "zod";
import { getUserHouseholds } from "@/lib/server/access";
import { errorResponse, isSameOrigin, json, parseJson } from "@/lib/server/http";
import { applyLegacyOps, legacyOpSchema } from "@/lib/server/legacy-sync";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ ops: z.array(legacyOpSchema).max(1000) });

/** Einmalige Übernahme noch nicht synchronisierter Änderungen aus Version 1. */
export async function POST(request: Request) {
    if (!isSameOrigin(request)) return errorResponse(403, "Ungültiger Origin");
    const user = await getCurrentUser({ refresh: true });
    if (!user) return errorResponse(401, "Nicht angemeldet");

    const body = await parseJson(request, bodySchema);
    if ("error" in body) return body.error;

    const households = await getUserHouseholds(user.id);
    const result = await applyLegacyOps({ userId: user.id, householdIds: households.map((h) => h.id) }, body.data.ops);
    return json(result);
}
