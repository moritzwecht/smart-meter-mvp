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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto border border-white/20"
                    >
                        <div className="p-8 sm:p-10 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black">Neuer Zähler</h2>
                                <button
                                    onClick={onClose}
                                    className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 transition-all text-slate-500"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="z.B. Hauptzähler"
                                        className="w-full p-5 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Typ</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(["ELECTRICITY", "GAS", "WATER"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleTypeChange(t)}
                                                className={cn(
                                                    "py-4 rounded-2xl border-2 transition-all font-black text-xs uppercase tracking-tighter",
                                                    type === t
                                                        ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                                                        : "border-slate-100 dark:border-slate-800 bg-transparent text-slate-400"
                                                )}
                                            >
                                                {t === "ELECTRICITY" ? "Strom" : t === "GAS" ? "Gas" : "Wasser"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Einheit</label>
                                        <input
                                            type="text"
                                            value={unit}
                                            onChange={(e) => setUnit(e.target.value)}
                                            className="w-full p-5 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-mono font-bold text-center"
                                        />
                                    </div>
                                </div>

                                <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10 flex gap-4">
                                    <Info className="w-6 h-6 text-primary shrink-0" />
                                    <p className="text-xs text-primary/80 leading-relaxed font-medium">
                                        Optional: Gib Preis und Abschlag ein für genauere Prognosen und die Status-Ampel.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest text-nowrap">Preis / {unit}</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={unitPrice}
                                            onChange={(e) => setUnitPrice(e.target.value.replace(".", ","))}
                                            placeholder="0,00"
                                            className="w-full p-5 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-bold text-center"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Abschlag</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={monthlyPayment}
                                            onChange={(e) => setMonthlyPayment(e.target.value.replace(".", ","))}
                                            placeholder="0,00"
                                            className="w-full p-5 bg-slate-50 dark:bg-slate-800/40 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-bold text-center"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={!name || isSaving}
                                    className={cn(
                                        "w-full py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all mt-4 shadow-2xl",
                                        !name || isSaving
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-300 pointer-events-none"
                                            : "bg-primary text-white hover:bg-primary/90 active:scale-95 shadow-primary/30"
                                    )}
                                >
                                    {isSaving ? "Wird angelegt..." : (
                                        <>
                                            <Check className="w-6 h-6 stroke-[3px]" />
                                            Zähler anlegen
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
