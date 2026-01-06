"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Home, Zap, Droplets, Flame, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface EfficiencySettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    household: any;
    meters: any[];
    onUpdateHousehold: (data: any) => Promise<void>;
    onUpdateMeter: (id: number, name: string, type: string, unit: string, expectedDailyAverage: string) => Promise<void>;
    isPending: boolean;
}

export function EfficiencySettingsDialog({
    isOpen,
    onClose,
    household,
    meters,
    onUpdateHousehold,
    onUpdateMeter,
    isPending,
}: EfficiencySettingsDialogProps) {
    const [formData, setFormData] = useState({
        sqm: household?.sqm || 0,
        persons: household?.persons || 1,
        heatingType: household?.heatingType || "GAS",
        waterHeatingType: household?.waterHeatingType || "CENTRAL",
    });

    const [meterTargets, setMeterTargets] = useState<Record<number, string>>({});

    useEffect(() => {
        if (meters) {
            const targets: Record<number, string> = {};
            meters.forEach((m) => {
                targets[m.id] = m.expectedDailyAverage || "";
            });
            setMeterTargets(targets);
        }
    }, [meters]);

    const calculateAverages = () => {
        const { sqm, persons, waterHeatingType } = formData;
        const newTargets: Record<number, string> = { ...meterTargets };

        meters.forEach((meter) => {
            let daily = 0;
            if (meter.type === "ELECTRICITY") {
                // 1500 kWh (1p) + 1000 kWh per extra person
                let yearly = 1500 + (persons - 1) * 1000;
                if (waterHeatingType === "ELECTRIC") {
                    yearly += persons * 800;
                }
                daily = yearly / 365;
            } else if (meter.type === "WATER") {
                // 122 L/person/day
                daily = persons * 122;
                if (meter.unit === "m³") {
                    daily = daily / 1000;
                }
            } else if (meter.type === "GAS") {
                // 140 kWh/sqm/year
                let yearly = sqm * 140;
                if (waterHeatingType === "GAS") {
                    yearly += persons * 800;
                }
                daily = yearly / 365;
            }
            newTargets[meter.id] = daily.toFixed(3);
        });

        setMeterTargets(newTargets);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await onUpdateHousehold(formData);
        for (const meter of meters) {
            await onUpdateMeter(meter.id, meter.name, meter.type, meter.unit, meterTargets[meter.id]);
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Barometer Einstellungen</h2>
                                <p className="text-xs text-muted-foreground mt-1">Konfiguriere deine Haushaltswerte</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                            {/* Household Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                                    <Home className="w-3 h-3" />
                                    Haushalt
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase">Wohnfläche (qm)</label>
                                        <input
                                            type="number"
                                            value={formData.sqm}
                                            onChange={(e) => setFormData({ ...formData, sqm: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-accent/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase">Personen</label>
                                        <input
                                            type="number"
                                            value={formData.persons}
                                            onChange={(e) => setFormData({ ...formData, persons: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-accent/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase">Warmwasserbereitung</label>
                                    <select
                                        value={formData.waterHeatingType}
                                        onChange={(e) => setFormData({ ...formData, waterHeatingType: e.target.value })}
                                        className="w-full bg-accent/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                    >
                                        <option value="CENTRAL">Zentral (Heizanlage)</option>
                                        <option value="GAS">Gas-Etagenheizung</option>
                                        <option value="ELECTRIC">Elektrisch (Durchlauferhitzer)</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={calculateAverages}
                                    className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] bg-accent hover:bg-accent/80 transition-colors rounded-xl"
                                >
                                    Durchschnittswerte berechnen
                                </button>
                            </div>

                            {/* Meters Section */}
                            <div className="space-y-4 pt-4 border-t border-border">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                                    <Zap className="w-3 h-3" />
                                    Zielwerte pro Zähler (Schnitt)
                                </div>

                                <div className="grid gap-3">
                                    {meters.map((meter) => (
                                        <div key={meter.id} className="flex items-center gap-4 bg-accent/20 p-3 rounded-xl">
                                            <div className="flex-1">
                                                <div className="text-[10px] font-bold uppercase opacity-50">{meter.name}</div>
                                                <div className="text-xs font-bold">{meter.type}</div>
                                            </div>
                                            <div className="w-32 flex flex-col items-end">
                                                <input
                                                    type="text"
                                                    value={meterTargets[meter.id] || ""}
                                                    onChange={(e) => setMeterTargets({ ...meterTargets, [meter.id]: e.target.value })}
                                                    className="w-full bg-accent/50 border-none rounded-lg p-2 text-right text-xs font-mono"
                                                />
                                                <span className="text-[10px] text-muted-foreground mt-1">{meter.unit}/Tag</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full bg-primary text-primary-foreground py-4 rounded-xl text-xs font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
