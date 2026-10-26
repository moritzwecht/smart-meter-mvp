"use client";

import { Bell, BellOff, Send } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getReminderSettings, removePushSubscription, savePushSubscription, sendTestPush, setReminderDay } from "@/app/actions/profile";
import { FieldLabel } from "@/components/ui/AddTile";
import { Alert } from "@/components/ui/Alert";
import { Section } from "@/components/ui/Section";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { runAction } from "@/lib/client-actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
    const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

function pushSupported(): boolean {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

const noop = () => () => {};

async function currentSubscription(): Promise<PushSubscription | null> {
    if (!pushSupported()) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
}

export function ReminderSection() {
    const toast = useToast();
    const supported = useSyncExternalStore(noop, pushSupported, () => false);
    const [loaded, setLoaded] = useState(false);
    const [day, setDay] = useState<number | null>(null);
    const [serverPush, setServerPush] = useState(false);
    const [deviceEnabled, setDeviceEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const result = await runAction(getReminderSettings);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setDay(result.data.reminderDay);
        setServerPush(result.data.pushAvailable);
        const sub = await currentSubscription();
        setDeviceEnabled(!!sub && result.data.endpoints.includes(sub.endpoint));
        setLoaded(true);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Einstellungen vom Server laden
        void load();
    }, [load]);

    const changeDay = async (value: number | null) => {
        setDay(value);
        const result = await runAction(() => setReminderDay({ day: value }));
        if (!result.ok) toast({ message: result.error, variant: "error" });
    };

    const enableDevice = async () => {
        setBusy(true);
        setError("");
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setError("Benachrichtigungen wurden nicht erlaubt. Du kannst das in den Browser-/Systemeinstellungen ändern.");
                return;
            }
            const registration = await navigator.serviceWorker.ready;
            const sub =
                (await registration.pushManager.getSubscription()) ??
                (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
            const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            const result = await runAction(() => savePushSubscription({ endpoint: json.endpoint, keys: json.keys }));
            if (!result.ok) throw new Error(result.error);
            setDeviceEnabled(true);
            if (day === null) await changeDay(1);
            toast({ message: "Erinnerungen auf diesem Gerät aktiviert", variant: "success" });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Aktivieren fehlgeschlagen.");
        } finally {
            setBusy(false);
        }
    };

    const disableDevice = async () => {
        setBusy(true);
        const sub = await currentSubscription();
        if (sub) {
            await runAction(() => removePushSubscription({ endpoint: sub.endpoint }));
            await sub.unsubscribe().catch(() => undefined);
        }
        setDeviceEnabled(false);
        setBusy(false);
    };

    const test = async () => {
        setBusy(true);
        const result = await runAction(sendTestPush);
        setBusy(false);
        toast(result.ok ? { message: "Test gesendet – gleich sollte eine Benachrichtigung kommen.", variant: "success" } : { message: result.error, variant: "error" });
    };

    return (
        <Section title="Ablese-Erinnerung" icon={<Bell className="w-3.5 h-3.5" />}>
            {!loaded && !error && <Spinner />}
            {loaded && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <FieldLabel htmlFor="reminder-day">Monatlich erinnern am</FieldLabel>
                        <select
                            id="reminder-day"
                            value={day ?? ""}
                            onChange={(e) => changeDay(e.target.value ? Number(e.target.value) : null)}
                            className="input-field w-full"
                        >
                            <option value="">Aus</option>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>
                                    {d}. des Monats
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Erinnert nur, wenn ein Zähler seit mindestens 5 Tagen keinen neuen Stand hat.
                        </p>
                    </div>

                    {!serverPush ? (
                        <Alert variant="info">Push ist auf dem Server noch nicht eingerichtet (VAPID-Schlüssel, siehe README).</Alert>
                    ) : !supported ? (
                        <Alert variant="info">
                            Dieses Gerät unterstützt hier keine Push-Benachrichtigungen. Auf iPhone/iPad: in Safari „Zum Home-Bildschirm“
                            hinzufügen und die App von dort öffnen.
                        </Alert>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                            {deviceEnabled ? (
                                <>
                                    <button type="button" onClick={test} disabled={busy} className="flex-1 btn btn-secondary py-3 text-xs">
                                        <Send className="w-4 h-4" />
                                        Test senden
                                    </button>
                                    <button type="button" onClick={disableDevice} disabled={busy} className="flex-1 btn btn-ghost border-2 border-border py-3 text-xs">
                                        <BellOff className="w-4 h-4" />
                                        Auf diesem Gerät aus
                                    </button>
                                </>
                            ) : (
                                <button type="button" onClick={enableDevice} disabled={busy} className="flex-1 btn btn-primary py-3 text-xs">
                                    {busy ? <Spinner className="text-primary-foreground" /> : <Bell className="w-4 h-4" />}
                                    Auf diesem Gerät aktivieren
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
            {error && <Alert variant="error">{error}</Alert>}
        </Section>
    );
}
