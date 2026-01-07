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
    onUpdateMeter: (id: number, name: string, type: string, unit: string, expectedDailyAverage: string, yearlyTarget: string, pricePerUnit: string, monthlyPayment: string) => Promise<void>;
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
    const [meterData, setMeterData] = useState<Record<number, {
        yearlyTarget: string;
        pricePerUnit: string;
        monthlyPayment: string;
        dailyAverage: string;
    }>>({});

    useEffect(() => {
        if (isOpen && meters) {
            const data: Record<number, any> = {};
            meters.forEach((m) => {
                data[m.id] = {
                    yearlyTarget: m.yearlyTarget || "",
                    pricePerUnit: m.pricePerUnit || "",
                    monthlyPayment: m.monthlyPayment || "",
                    dailyAverage: m.expectedDailyAverage || "",
                };
            });
            setMeterData(data);
        }
    }, [isOpen]); // Only run when dialog is opened/closed

    const updateField = (id: number, field: string, value: string) => {
        setMeterData(prev => {
            const current = { ...prev[id], [field]: value };

            // Auto-calculate daily average if yearly target changes
            if (field === "yearlyTarget") {
                const yearly = parseFloat(value.replace(",", ".")) || 0;
                current.dailyAverage = (yearly / 365).toFixed(3);
            }

            return { ...prev, [id]: current };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        for (const meter of meters) {
            const data = meterData[meter.id];
            if (data) {
                await onUpdateMeter(
                    meter.id,
                    meter.name,
                    meter.type,
                    meter.unit,
                    data.dailyAverage,
                    data.yearlyTarget,
                    data.pricePerUnit,
                    data.monthlyPayment
                );
            }
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Barometer Einstellungen</h2>
                                <p className="text-xs text-muted-foreground mt-1">Konfiguriere deine Verbrauchsziele und Kosten</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-accent rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                            <div className="grid gap-6">
                                {meters.map((meter) => {
                                    const data = meterData[meter.id] || { yearlyTarget: "", pricePerUnit: "", monthlyPayment: "", dailyAverage: "" };
                                    return (
                                        <div key={meter.id} className="bg-accent/20 p-4 rounded-2xl space-y-4">
                                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        {meter.type === 'ELECTRICITY' ? <Zap className="w-4 h-4" /> :
                                                            meter.type === 'GAS' ? <Flame className="w-4 h-4" /> :
                                                                <Droplets className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-50">{meter.name}</div>
                                                        <div className="text-xs font-bold">{meter.type}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold uppercase opacity-30">Tagesziel</div>
                                                    <div className="text-xs font-mono font-bold text-primary">{data.dailyAverage} {meter.unit}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-tight opacity-50">Zielverbrauch / Jahr</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={data.yearlyTarget}
                                                            onChange={(e) => updateField(meter.id, "yearlyTarget", e.target.value)}
                                                            placeholder="z.B. 3500"
                                                            className="w-full bg-background border border-border/50 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 transition-all"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">{meter.unit}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-tight opacity-50">Preis pro {meter.unit}</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={data.pricePerUnit}
                                                            onChange={(e) => updateField(meter.id, "pricePerUnit", e.target.value)}
                                                            placeholder="z.B. 0,35"
                                                            className="w-full bg-background border border-border/50 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 transition-all"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">€</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-tight opacity-50">Monatlicher Abschlag</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={data.monthlyPayment}
                                                            onChange={(e) => updateField(meter.id, "monthlyPayment", e.target.value)}
                                                            placeholder="z.B. 100"
                                                            className="w-full bg-background border border-border/50 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 transition-all"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">€</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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

