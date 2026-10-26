import { createServer, type Server } from "node:http";

/*
 * Kleiner Ersatz für die Resend-API: Die App schickt ihre E-Mails im Browser-Test
 * hierher (RESEND_BASE_URL), der Test liest die Anmeldecodes über GET /mails aus.
 */

export const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 3199);
export const MAIL_URL = `http://127.0.0.1:${MAIL_PORT}`;

interface CapturedMail {
    to: string[];
    subject: string;
    text: string;
}

export function startMailServer(): Promise<Server> {
    const mails: CapturedMail[] = [];
    const server = createServer((req, res) => {
        if (req.method === "POST" && req.url === "/emails") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                const data = JSON.parse(body) as { to: string | string[]; subject: string; text?: string };
                mails.push({ to: [data.to].flat(), subject: data.subject, text: data.text ?? "" });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ id: `e2e-${mails.length}` }));
            });
            return;
        }
        if (req.method === "GET" && req.url === "/mails") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(mails));
            return;
        }
        res.writeHead(404).end();
    });
    return new Promise((resolve) => server.listen(MAIL_PORT, "127.0.0.1", () => resolve(server)));
}

/** Wartet auf die nächste Code-Mail an `email` (nach `after` bereits gelesenen Mails). */
export async function waitForCode(email: string, after = 0): Promise<{ code: string; count: number }> {
    for (let i = 0; i < 50; i++) {
        const mails = (await (await fetch(`${MAIL_URL}/mails`)).json()) as CapturedMail[];
        const mine = mails.filter((m) => m.to.includes(email));
        const code = mine.length > after ? mine.at(-1)!.subject.match(/^(\d{6}) /)?.[1] : undefined;
        if (code) return { code, count: mine.length };
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Keine Code-Mail an ${email}`);
}
