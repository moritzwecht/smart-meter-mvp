"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Droplets, Flame, History, Trash2 } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

interface MeterSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meter: any;
    onUpdateMeter: (id: number, name: string, type: string, unit: string) => void;
    onDeleteReading: (id: number) => void;
    isPending?: boolean;
}

export function MeterSettingsDialog({
    isOpen,
    onClose,
    meter,
    onUpdateMeter,
    onDeleteReading,
    isPending,
}: MeterSettingsDialogProps) {
    if (!meter) return null;

    const types = [
        { type: "ELECTRICITY", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", label: "Strom" },
        { type: "WATER", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10", label: "Wasser" },
        { type: "GAS", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", label: "Gas" },
    ] as const;

    const units = ["kWh", "m³", "l"];

    const calculateStats = () => {
        const readings = meter.readings || [];
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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="flex justify-between items-center p-3 border-b border-border">
                            <h2 className="text-xl font-black tracking-tight">Zähler bearbeiten</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                                aria-label="Schließen"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Typ</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {types.map((t) => (
                                        <button
                                            key={t.type}
                                            disabled={isPending}
                                            onClick={() => onUpdateMeter(meter.id, t.label, t.type, meter.unit)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${meter.type === t.type
                                                ? "border-primary bg-primary/5"
                                                : "border-transparent bg-accent/30 hover:bg-accent/50"
                                                } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <t.icon className={`w-6 h-6 ${t.color}`} />
                                            <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Einheit</label>
                                <div className="flex flex-wrap gap-2">
                                    {units.map((u) => (
                                        <button
                                            key={u}
                                            disabled={isPending}
                                            onClick={() => onUpdateMeter(meter.id, meter.name, meter.type, u)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${meter.unit === u
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "bg-accent/50 hover:bg-accent text-muted-foreground"
                                                } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            {u}
                                        </button>
                                    ))}
                                    <input
                                        type="text"
                                        disabled={isPending}
                                        placeholder="Andere..."
                                        value={units.includes(meter.unit) ? "" : meter.unit}
                                        onChange={(e) => onUpdateMeter(meter.id, meter.name, meter.type, e.target.value)}
                                        className="flex-1 min-w-[120px] px-4 py-2 rounded-xl text-sm font-bold bg-accent/30 border-2 border-transparent focus:border-primary/30 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Statistik</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {stats ? (
                                        <>
                                            <div className="p-3 bg-accent/30 rounded-2xl space-y-1">
                                                <div className="text-[10px] uppercase font-bold text-muted-foreground">Gesamtverbrauch</div>
                                                <div className="text-2xl font-black">{formatNumber(stats.diff, 3)} {meter.unit}</div>
                                                <div className="text-[10px] opacity-40">über {Math.floor(stats.days)} Tage</div>
                                            </div>
                                            <div className="p-3 bg-green-500/5 rounded-2xl space-y-1 border border-green-500/10">
                                                <div className="text-[10px] uppercase font-bold text-green-600/60">Tagesdurchschnitt</div>
                                                <div className="text-2xl font-black text-green-600">{formatNumber(stats.avg, 2)} {meter.unit}</div>
                                                <div className="text-[10px] text-green-600/40">pro 24 Stunden</div>
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
                                    {meter.readings && meter.readings.length > 0 ? (
                                        [...meter.readings]
                                            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((r: any) => (
                                                <div key={r.id} className="flex justify-between items-center p-3 hover:bg-accent/20 transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                                            <History className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black">{r.value} {meter.unit}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{new Date(r.date).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        disabled={isPending}
                                                        onClick={() => onDeleteReading(r.id)}
                                                        className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:pointer-events-none"
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

                        <div className="p-3 border-t border-border bg-accent/10">
                            <button onClick={onClose} className="w-full btn btn-primary py-3">
                                Schließen
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
