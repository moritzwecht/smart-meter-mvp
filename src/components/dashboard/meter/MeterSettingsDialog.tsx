import { useState, useEffect } from "react";
import { Zap, Droplets, Flame, History, Trash2 } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface MeterSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meter: any;
    onUpdateMeter: (id: number, type: string, unit: string) => void;
    onDeleteReading: (id: number) => void;
    onDeleteMeter: (id: number) => void;
    isPending?: boolean;
}

export function MeterSettingsDialog({
    isOpen,
    onClose,
    meter,
    onUpdateMeter,
    onDeleteReading,
    onDeleteMeter,
    isPending,
}: MeterSettingsDialogProps) {
    const [lastMeter, setLastMeter] = useState(meter);
    useEffect(() => {
        if (meter) setLastMeter(meter);
    }, [meter]);

    const activeMeter = meter || lastMeter;

    if (!activeMeter) return null;

    const types = [
        { type: "ELECTRICITY", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", label: "Strom" },
        { type: "WATER", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10", label: "Wasser" },
        { type: "GAS", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", label: "Gas" },
    ] as const;

    const calculateStats = () => {
        const readings = activeMeter.readings || [];
        if (readings.length < 2) return null;

        const sorted = [...readings].sort(
            (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const diff = parseSafe(last.value) - parseSafe(first.value);
        const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
        const avg = days > 0 ? diff / days : 0;

        return { diff, days, avg };
    };

    const stats = calculateStats();

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title={`${types.find(t => t.type === activeMeter.type)?.label || "Zähler"}zähler`}
            className="sm:max-w-2xl"
            footer={
                <div className="flex gap-2">
                    <button
                        disabled={isPending}
                        onClick={() => onDeleteMeter(activeMeter.id)}
                        className="flex-1 btn btn-danger py-3 flex items-center justify-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Zähler löschen
                    </button>
                    <button onClick={onClose} className="flex-1 btn btn-secondary py-3">
                        Schließen
                    </button>
                </div>
            }
        >
            <div className="space-y-8">
                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Statistik</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stats ? (
                            <>
                                <div className="p-3 bg-accent/30 rounded-2xl space-y-1 border-2 border-border/50">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Gesamtverbrauch</div>
                                    <div className="text-2xl font-black">{formatNumber(stats.diff, 3)} {activeMeter.unit}</div>
                                    <div className="text-[10px] opacity-40">über {Math.floor(stats.days)} Tage</div>
                                </div>
                                <div className="p-3 bg-accent/30 rounded-2xl space-y-1 border-2 border-border/50">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Tagesdurchschnitt</div>
                                    <div className="text-2xl font-black">{formatNumber(stats.avg, 2)} {activeMeter.unit}</div>
                                    <div className="text-[10px] opacity-40">pro 24 Stunden</div>
                                </div>
                            </>
                        ) : (
                            <div className="col-span-full p-8 text-center bg-accent/20 rounded-2xl border border-dashed border-border text-xs text-muted-foreground italic">
                                Mindestens zwei Ablesungen für Statistik benötigt...
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Verlauf</label>
                    <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50 relative">
                        {isPending && (
                            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <Spinner size={24} />
                            </div>
                        )}
                        {activeMeter.readings && activeMeter.readings.length > 0 ? (
                            [...activeMeter.readings]
                                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((r: any) => (
                                    <div key={r.id} className="flex justify-between items-center p-3 hover:bg-accent/20 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                                <History className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black">{r.value} {activeMeter.unit}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase">
                                                    {new Date(r.date).toLocaleDateString()},&nbsp;
                                                    {new Date(r.date).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            disabled={isPending}
                                            onClick={() => onDeleteReading(r.id)}
                                            className="p-2 text-muted-foreground hover:text-red-500 transition-all disabled:pointer-events-none"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                        ) : (
                            <div className="p-12 text-center text-xs text-muted-foreground italic">Noch keine Ablesungen vorhanden...</div>
                        )}
                    </div>
                </div>
            </div>
        </BaseDialog>
    );
}
