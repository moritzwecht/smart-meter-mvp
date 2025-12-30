"use client";

import { useState } from "react";
import { X, Check, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AddMeterDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        name: string;
        type: "ELECTRICITY" | "GAS" | "WATER";
        unit: string;
        unitPrice?: number;
        monthlyPayment?: number;
    }) => Promise<void>;
}

export function AddMeterDialog({ isOpen, onClose, onSave }: AddMeterDialogProps) {
    const [name, setName] = useState("");
    const [type, setType] = useState<"ELECTRICITY" | "GAS" | "WATER">("ELECTRICITY");
    const [unit, setUnit] = useState("kWh");
    const [unitPrice, setUnitPrice] = useState("");
    const [monthlyPayment, setMonthlyPayment] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleTypeChange = (newType: "ELECTRICITY" | "GAS" | "WATER") => {
        setType(newType);
        if (newType === "ELECTRICITY") setUnit("kWh");
        if (newType === "GAS") setUnit("m³");
        if (newType === "WATER") setUnit("m³");
    };

    const handleSave = async () => {
        if (!name || isSaving) return;
        setIsSaving(true);
        try {
            await onSave({
                name,
                type,
                unit,
                unitPrice: unitPrice ? parseFloat(unitPrice.replace(",", ".")) : undefined,
                monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment.replace(",", ".")) : undefined,
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, x: "-50%", y: "-50%" }}
                        animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
                        exit={{ scale: 0.9, opacity: 0, x: "-50%", y: "-50%" }}
                        className="fixed top-1/2 left-1/2 w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl z-[60] overflow-hidden"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold">Neuer Zähler</h2>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-foreground/50">Name des Zählers</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="z.B. Hauptzähler"
                                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-foreground/50">Zählertyp</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(["ELECTRICITY", "GAS", "WATER"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleTypeChange(t)}
                                                className={cn(
                                                    "py-3 rounded-xl border-2 transition-all font-medium text-sm",
                                                    type === t
                                                        ? "border-primary bg-primary text-white"
                                                        : "border-slate-100 dark:border-slate-800 bg-transparent text-foreground/40"
                                                )}
                                            >
                                                {t === "ELECTRICITY" ? "Strom" : t === "GAS" ? "Gas" : "Wasser"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-foreground/50">Einheit</label>
                                        <input
                                            type="text"
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
                                    <Info className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-xs text-primary/80 leading-relaxed italic">
                                        Optional: Gib Preis und Abschlag ein für genauere Prognosen und die Status-Ampel.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-foreground/50 text-nowrap">Preis pro {unit} (€)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={unitPrice}
                                            onChange={(e) => setUnitPrice(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-foreground/50">Abschlag / Monat (€)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={monthlyPayment}
                                            onChange={(e) => setMonthlyPayment(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={!name || isSaving}
                                    className={cn(
                                        "w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all mt-4",
                                        !name || isSaving
                                            ? "bg-slate-100 dark:bg-slate-800 text-foreground/20"
                                            : "bg-primary text-white hover:bg-primary/90 active:scale-95 shadow-xl shadow-primary/25"
                                    )}
                                >
                                    {isSaving ? "Wird angelegt..." : (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Zähler anlegen
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
