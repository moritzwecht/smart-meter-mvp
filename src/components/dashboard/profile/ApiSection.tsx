"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createToken, deleteToken, getApiTokens, type ApiTokenInfo } from "@/app/actions/profile";
import { Alert } from "@/components/ui/Alert";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Section } from "@/components/ui/Section";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { runAction } from "@/lib/client-actions";
import { formatDate, formatRelativeDay } from "@/lib/meter/format";
import { meterTitle } from "@/lib/meter/names";
import { db } from "@/lib/offline/db";

async function copy(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

/** Beispiel für Home Assistant: REST-Befehl (configuration.yaml) */
function restCommandExample(origin: string) {
    return `# configuration.yaml
rest_command:
  my_home_reading:
    url: "${origin}/api/v1/readings"
    method: POST
    headers:
      # in secrets.yaml: my_home_token: "Bearer mh_…"
      Authorization: !secret my_home_token
      Content-Type: application/json
    payload: '{"meterId": "{{ meter_id }}", "value": {{ value }}}'`;
}

/** Beispiel-Automation – als eigener Eintrag für automations.yaml (oder in der HA-Oberfläche als YAML einfügen) */
function automationExample(meterId: string, title: string, unit: string) {
    return `# automations.yaml – oder in Home Assistant unter
# Einstellungen → Automationen → Neu → „Als YAML bearbeiten“
- alias: "Zählerstand ${title} an My Home"
  description: "Sensor muss in ${unit} melden"
  triggers:
    - trigger: time
      at: "23:55:00"
  conditions:
    # nur gültige Zahlen senden (nicht "unavailable"/"unknown")
    - condition: template
      value_template: "{{ states('sensor.DEIN_ZAEHLER') | is_number }}"
  actions:
    - action: rest_command.my_home_reading
      data:
        meter_id: "${meterId}"
        value: "{{ states('sensor.DEIN_ZAEHLER') }}"`;
}

function CodeBlock({ label, code, onCopy }: { label: string; code: string; onCopy: () => void }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{label}</span>
                <button type="button" onClick={onCopy} className="min-h-11 px-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                    <Copy className="w-3.5 h-3.5" aria-hidden />
                    Kopieren<span className="sr-only">: {label}</span>
                </button>
            </div>
            {/* tabIndex: per Tastatur scrollbar */}
            <pre tabIndex={0} aria-label={label} className="text-[11px] leading-relaxed bg-accent/30 rounded-xl p-3 overflow-x-auto">
                {code}
            </pre>
        </div>
    );
}

export function ApiSection() {
    const toast = useToast();
    const confirm = useConfirm();
    const [tokens, setTokens] = useState<ApiTokenInfo[] | null>(null);
    const [name, setName] = useState("Home Assistant");
    const [fresh, setFresh] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [showExample, setShowExample] = useState(false);
    const [exampleId, setExampleId] = useState<string | null>(null);
    const meters = useLiveQuery(() => db.meters.toArray(), []);
    const households = useLiveQuery(() => db.households.toArray(), []);

    const load = useCallback(async () => {
        const result = await runAction(getApiTokens);
        if (result.ok) setTokens(result.data);
        else setError(result.error);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Token-Liste vom Server laden
        void load();
    }, [load]);

    const create = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const result = await runAction(() => createToken({ name }));
        setBusy(false);
        if (!result.ok) return toast({ message: result.error, variant: "error" });
        setFresh(result.data.token);
        await load();
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const exampleMeter = meters?.find((m) => m.id === exampleId) ?? meters?.[0];
    const copyText = async (text: string, what: string) => toast((await copy(text)) ? { message: `${what} kopiert`, variant: "success" } : "Kopieren nicht möglich");

    return (
        <Section title="Home Assistant & API" icon={<Plug className="w-3.5 h-3.5" />}>
            <p className="text-sm text-muted-foreground">
                Mit einem API-Token können z. B. Home Assistant oder ESPHome Zählerstände automatisch eintragen.
            </p>

            {fresh && (
                <Alert variant="success" title="Neuer Token – kopier ihn jetzt, er wird nur einmal angezeigt">
                    <div className="space-y-2 mt-2">
                        <code className="block break-all text-xs bg-background/60 rounded px-2 py-1.5 text-foreground">{fresh}</code>
                        <button type="button" className="w-full btn btn-secondary min-h-11 text-xs" onClick={() => void copyText(fresh, "Token")}>
                            <Copy className="w-3.5 h-3.5" aria-hidden />
                            Token kopieren
                        </button>
                    </div>
                </Alert>
            )}

            {tokens === null && !error && <Spinner />}
            {error && <Alert variant="warning">{error}</Alert>}
            {tokens && tokens.length > 0 && (
                <ul className="bg-card border border-border rounded-2xl divide-y divide-border/50">
                    {tokens.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{t.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        {t.tokenPrefix}… · erstellt {formatDate(t.createdAt)}
                                        {t.lastUsedAt ? ` · genutzt ${formatRelativeDay(t.lastUsedAt)}` : " · noch nie genutzt"}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label={`Token ${t.name} löschen`}
                                className="w-11 h-11 -m-2 flex items-center justify-center text-muted-foreground hover:text-red-700 dark:hover:text-red-400"
                                onClick={async () => {
                                    if (!(await confirm({ title: `Token „${t.name}“ löschen?`, message: "Geräte, die ihn nutzen, können danach keine Werte mehr eintragen.", confirmLabel: "Löschen", danger: true }))) return;
                                    const result = await runAction(() => deleteToken({ id: t.id }));
                                    if (!result.ok) toast({ message: result.error, variant: "error" });
                                    await load();
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <form onSubmit={create} className="flex gap-2">
                <input aria-label="Name für neuen Token" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="input-field flex-1 min-w-0" />
                <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary px-4 text-xs">
                    {busy ? <Spinner className="text-primary-foreground" /> : "Token erstellen"}
                </button>
            </form>

            {meters && meters.length > 0 && (
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => setShowExample((v) => !v)}
                        aria-expanded={showExample}
                        className="min-h-11 text-xs font-bold text-primary hover:underline"
                    >
                        {showExample ? "Beispiel ausblenden" : "Zähler-IDs & Beispiel für Home Assistant anzeigen"}
                    </button>
                    {showExample && (
                        <div className="space-y-4">
                            <ul className="text-xs space-y-1" aria-label="Zähler-IDs">
                                {meters.map((m) => (
                                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-accent/30 pl-3">
                                        <span className="min-w-0 truncate">
                                            <span className="font-bold">{meterTitle(m)}</span> ({m.unit}) · {households?.find((h) => h.id === m.householdId)?.name}
                                        </span>
                                        <button
                                            type="button"
                                            className="shrink-0 min-h-11 px-3 flex items-center gap-1.5 font-mono text-foreground/80 hover:text-primary"
                                            aria-label={`Zähler-ID von ${meterTitle(m)} kopieren`}
                                            onClick={() => void copyText(m.id, "Zähler-ID")}
                                        >
                                            {m.id.slice(0, 8)}…
                                            <Copy className="w-3.5 h-3.5" aria-hidden />
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div className="text-xs text-muted-foreground space-y-1">
                                <p className="font-bold text-foreground">So speichert die App deine Werte</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    <li>Höchstens ein Wert pro Viertelstunde (:00, :15, :30, :45) – spätere im selben Zeitfenster ersetzen ihn.</li>
                                    <li>Unveränderte Werte nur einmal am Tag.</li>
                                    <li>Ein Wert unter dem letzten Stand wird abgelehnt – nach einem Zählertausch {'"isReplacement": true'} mitsenden.</li>
                                    <li>Der Sensor muss in derselben Einheit melden wie der Zähler in der App (z. B. m³, nicht Liter).</li>
                                    <li>Empfehlung: stündlich oder einmal täglich senden.</li>
                                </ul>
                            </div>

                            {exampleMeter && (
                                <div className="space-y-3">
                                    {meters.length > 1 && (
                                        <label className="flex items-center gap-2 text-xs font-bold">
                                            Beispiel für
                                            <select
                                                value={exampleMeter.id}
                                                onChange={(e) => setExampleId(e.target.value)}
                                                className="input-field py-2 min-h-11 flex-1 min-w-0"
                                            >
                                                {meters.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {meterTitle(m)} ({m.unit})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <CodeBlock label="REST-Befehl (configuration.yaml)" code={restCommandExample(origin)} onCopy={() => void copyText(restCommandExample(origin), "Beispiel")} />
                                    <CodeBlock
                                        label="Automation (automations.yaml)"
                                        code={automationExample(exampleMeter.id, meterTitle(exampleMeter), exampleMeter.unit)}
                                        onCopy={() => void copyText(automationExample(exampleMeter.id, meterTitle(exampleMeter), exampleMeter.unit), "Beispiel")}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Section>
    );
}
