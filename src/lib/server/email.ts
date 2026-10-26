import "server-only";
import { Resend } from "resend";
import { emailConfig, isProduction } from "./env";

let client: Resend | null | undefined;

function resend(): Resend | null {
    if (client === undefined) {
        const { apiKey } = emailConfig();
        client = apiKey ? new Resend(apiKey) : null;
    }
    return client;
}

export function isEmailConfigured(): boolean {
    return resend() !== null;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

interface Mail {
    to: string;
    subject: string;
    /** Absätze; Links werden als Button gerendert. */
    paragraphs: string[];
    action?: { label: string; url: string };
}

/**
 * Verschickt eine E-Mail über Resend. Ohne API-Key wird sie in der Entwicklung
 * auf der Konsole ausgegeben (in Produktion nie – dort landen sonst Login-Links in Logs).
 * Gibt zurück, ob die Mail verschickt wurde.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
    const text = [...mail.paragraphs, mail.action ? `${mail.action.label}: ${mail.action.url}` : ""]
        .filter(Boolean)
        .join("\n\n");
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px">My Home</h1>
  ${mail.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
  ${
      mail.action
          ? `<p style="margin:24px 0"><a href="${escapeHtml(mail.action.url)}" style="background:#0f172a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">${escapeHtml(mail.action.label)}</a></p>
             <p style="font-size:12px;color:#64748b;word-break:break-all">${escapeHtml(mail.action.url)}</p>`
          : ""
  }
</div>`;

    const r = resend();
    if (!r) {
        if (!isProduction) console.info(`\n[mail] an ${mail.to}: ${mail.subject}\n${text}\n`);
        return false;
    }
    try {
        const { error } = await r.emails.send({
            from: emailConfig().from,
            to: mail.to,
            subject: mail.subject,
            text,
            html,
        });
        if (error) {
            console.error("[mail] Versand fehlgeschlagen:", error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error("[mail] Versand fehlgeschlagen:", error);
        return false;
    }
}
