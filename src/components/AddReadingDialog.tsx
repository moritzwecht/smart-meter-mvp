"use client";

import { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getPushSubscription } from "@/lib/push";

interface AddReadingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meter: { id: number; name: string; unit: string } | null;
    onSave: (meterId: number, value: number, excludeEndpoint?: string) => Promise<void>;
}

export function AddReadingDialog({
    isOpen,
    onClose,
    meter,
    onSave,
}: AddReadingDialogProps) {
    const [value, setValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue("");
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSave = async () => {
        const parsed = parseFloat(value.replace(",", "."));
        if (!meter || isNaN(parsed)) return;
        setIsSaving(true);
        try {
            const subscription = await getPushSubscription();
            await onSave(meter.id, parsed, subscription?.endpoint || undefined);
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

                            <div className="flex flex-col gap-8">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-end">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Neuer Stand</label>
                                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase">
                                            {meter?.name}
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
                                            {meter?.unit}
                                        </span>
                                    </div>
                                </div>

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
                            </div>
                        </div>
                        {/* Safe area for mobile */}
                        <div className="h-6 sm:hidden bg-white dark:bg-slate-900" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
