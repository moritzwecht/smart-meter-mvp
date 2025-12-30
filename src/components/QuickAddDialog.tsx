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
        if (!selectedMeterId || !value) return;
        setIsSaving(true);
        try {
            await onSave(selectedMeterId, parseFloat(value.replace(",", ".")));
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
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ y: "100%", opacity: 0, x: "-50%" }}
                        animate={{ y: 0, opacity: 1, x: "-50%" }}
                        exit={{ y: "100%", opacity: 0, x: "-50%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl z-[60] overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Stand eintragen</h2>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {step === 1 ? (
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm text-foreground/50 mb-2">Wähle einen Zähler aus:</p>
                                    {meters.map((meter) => (
                                        <button
                                            key={meter.id}
                                            onClick={() => handleMeterSelect(meter.id)}
                                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
                                        >
                                            <span className="font-semibold text-lg">{meter.name}</span>
                                            <ChevronRight className="w-5 h-5 text-foreground/30" />
                                        </button>
                                    ))}
                                    {meters.length === 0 && (
                                        <p className="text-center py-8 text-foreground/40 italic">Keine Zähler angelegt.</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <label className="text-sm font-medium text-foreground/50">Neuer Zählerstand</label>
                                            <span className="text-sm font-bold text-primary">
                                                {meters.find(m => m.id === selectedMeterId)?.name}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                ref={inputRef}
                                                type="decimal"
                                                inputMode="decimal"
                                                value={value}
                                                onChange={(e) => setValue(e.target.value)}
                                                placeholder="0,00"
                                                className="w-full text-5xl font-bold bg-slate-50 dark:bg-slate-800/50 border-none focus:ring-2 focus:ring-primary/20 rounded-2xl p-6 py-10 transition-all placeholder:text-foreground/10"
                                                autoFocus
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-foreground/30">
                                                {meters.find(m => m.id === selectedMeterId)?.unit}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        disabled={!value || isSaving}
                                        className={cn(
                                            "w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl",
                                            !value || isSaving
                                                ? "bg-slate-200 dark:bg-slate-800 text-foreground/20"
                                                : "bg-primary text-white hover:bg-primary/90 active:scale-95 shadow-primary/25"
                                        )}
                                    >
                                        {isSaving ? "Speichert..." : (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Speichern
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-sm text-foreground/40 hover:text-foreground font-medium transition-colors py-2"
                                    >
                                        Zähler wechseln
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Safe area for mobile */}
                        <div className="h-4 sm:hidden" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
