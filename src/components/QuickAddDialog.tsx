"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuickAddDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meters: { id: number; name: string; type: string; unit: string }[];
    preselectedMeterId?: number | null;
    onSave: (meterId: number, value: number) => Promise<void>;
}

export function QuickAddDialog({
    isOpen,
    onClose,
    meters,
    preselectedMeterId,
    onSave,
}: QuickAddDialogProps) {
    const [step, setStep] = useState(preselectedMeterId ? 2 : 1);
    const [selectedMeterId, setSelectedMeterId] = useState<number | null>(preselectedMeterId || null);
    const [value, setValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (preselectedMeterId) {
                setStep(2);
                setSelectedMeterId(preselectedMeterId);
                setTimeout(() => inputRef.current?.focus(), 100);
            } else {
                setStep(1);
                setSelectedMeterId(null);
            }
            setValue("");
        }
    }, [isOpen, preselectedMeterId]);

    const handleMeterSelect = (id: number) => {
        setSelectedMeterId(id);
        setStep(2);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleSave = async () => {
        const parsed = parseFloat(value.replace(",", "."));
        if (!selectedMeterId || isNaN(parsed)) return;
        setIsSaving(true);
        try {
            await onSave(selectedMeterId, parsed);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
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
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 350 }}
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden pointer-events-auto border border-white/20 sm:mb-20"
                    >
                        <div className="p-8 sm:p-10">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold">Stand eintragen</h2>
                                <button
                                    onClick={onClose}
                                    className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 transition-all text-slate-500 hover:text-slate-900"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {step === 1 ? (
                                <div className="flex flex-col gap-4">
                                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Wähle einen Zähler:</p>
                                    <div className="flex flex-col gap-3">
                                        {meters.map((meter) => (
                                            <button
                                                key={meter.id}
                                                onClick={() => handleMeterSelect(meter.id)}
                                                className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl hover:bg-primary/5 hover:ring-2 hover:ring-primary/20 transition-all active:scale-[0.98] group"
                                            >
                                                <span className="font-bold text-xl group-hover:text-primary transition-colors">{meter.name}</span>
                                                <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                                    <ChevronRight className="w-5 h-5 text-primary" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {meters.length === 0 && (
                                        <div className="py-12 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                            Keine Zähler angelegt
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex justify-between items-end">
                                            <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Neuer Stand</label>
                                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase">
                                                {meters.find(m => m.id === selectedMeterId)?.name}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                inputMode="decimal"
                                                value={value}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(".", ",");
                                                    if (/^[0-9,]*$/.test(val)) setValue(val);
                                                }}
                                                placeholder="0,00"
                                                className="w-full text-6xl font-black bg-slate-50 dark:bg-slate-800/40 border-none focus:ring-4 focus:ring-primary/10 rounded-3xl p-8 py-12 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-800 text-center sm:text-left"
                                                autoFocus
                                            />
                                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">
                                                {meters.find(m => m.id === selectedMeterId)?.unit}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <button
                                            onClick={handleSave}
                                            disabled={!value || isSaving}
                                            className={cn(
                                                "w-full py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-2xl",
                                                !value || isSaving
                                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 pointer-events-none"
                                                    : "bg-primary text-white hover:bg-primary/90 active:scale-95 shadow-primary/30"
                                            )}
                                        >
                                            {isSaving ? "Speichert..." : (
                                                <>
                                                    <Check className="w-6 h-6 stroke-[3px]" />
                                                    Speichern
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setStep(1)}
                                            className="py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold transition-colors"
                                        >
                                            Zähler wechseln
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Safe area for mobile */}
                        <div className="h-6 sm:hidden bg-white dark:bg-slate-900" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
