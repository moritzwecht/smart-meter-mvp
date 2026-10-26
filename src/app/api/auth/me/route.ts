import { json } from "@/lib/server/http";
import { getCurrentUser, publicUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Aktueller Nutzer (oder `null`). Verlängert nebenbei die Session. */
export async function GET() {
    const user = await getCurrentUser({ refresh: true });
    return json({ user: user ? publicUser(user) : null });
}
