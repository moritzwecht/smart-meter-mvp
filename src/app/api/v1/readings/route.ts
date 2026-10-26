import { z } from "zod";
import { parseDecimal } from "@/lib/numbers";
import { authenticateApiRequest } from "@/lib/server/api-tokens";
import { errorResponse, json, parseJson } from "@/lib/server/http";
import { createReadingFromApi } from "@/lib/server/readings-api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    meterId: z.uuid({ error: "meterId muss die UUID des Zählers sein (siehe GET /api/v1/meters)." }),
    // Home Assistant liefert Sensorwerte gern als String ("12345.6") – beides erlaubt
    value: z.union([z.number(), z.string()]).transform((v, ctx) => {
        const n = parseDecimal(v);
        if (n === null || Math.abs(n) >= 1e11) {
            ctx.addIssue({ code: "custom", message: "value ist keine gültige Zahl." });
            return z.NEVER;
        }
        return n;
    }),
    date: z.iso.datetime({ offset: true }).optional(),
    isReplacement: z.boolean().optional(),
});

/**
 * POST /api/v1/readings – neue Ablesung, z. B. aus Home Assistant:
 *   curl -X POST https://…/api/v1/readings \
 *     -H "Authorization: Bearer mh_…" -H "Content-Type: application/json" \
 *     -d '{"meterId":"…","value":12345.6}'
 * Antwort: 201 (neu), 200 (unverändert bzw. API-Ablesung derselben Viertelstunde aktualisiert),
 * 404/422 (Fehler mit Beschreibung).
 */
export async function POST(request: Request) {
    const auth = await authenticateApiRequest(request);
    if (!auth) return errorResponse(401, "Ungültiger oder fehlender API-Token (Authorization: Bearer mh_…).");
    const body = await parseJson(request, bodySchema);
    if ("error" in body) return body.error;

    const result = await createReadingFromApi(auth.userId, body.data);
    if (result.status === "error") return errorResponse(result.httpStatus, result.error);
    return json(result, { status: result.status === "created" ? 201 : 200 });
}
