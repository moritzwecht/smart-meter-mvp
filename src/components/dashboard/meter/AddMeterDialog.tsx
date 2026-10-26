"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { addMeter } from "@/lib/offline/repo";
import { cn } from "@/lib/utils";
import { emptyMeterForm, MeterCostFields, meterFieldsFromForm, MeterTypeFields, type MeterFormState } from "./MeterForm";

interface AddMeterDialogProps {
    householdId: number;
    isOpen: boolean;
    onClose: () => void;
    onCreated: (meterId: string) => void;
}

export function AddMeterDialog({ householdId, isOpen, onClose, onCreated }: AddMeterDialogProps) {
    const [form, setForm] = useState<MeterFormState>(() => emptyMeterForm());
    const [showCosts, setShowCosts] = useState(false);
    const [error, setError] = useState("");

    const close = () => {
        onClose();
        setForm(emptyMeterForm());
        setShowCosts(false);
        setError("");
    };

    const create = async () => {
        const result = meterFieldsFromForm(form);
        if ("error" in result) {
            setError(result.error);
            setShowCosts(true);
            return;
        }
        const id = await addMeter(householdId, result.fields);
        close();
        onCreated(id);
    };

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={close}
            title="Neuer Zähler"
            className="sm:max-w-md"
            footer={
                <button onClick={create} className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black">
                    Erstellen
                </button>
            }
        >
            <div className="space-y-6">
                <MeterTypeFields form={form} onChange={setForm} />

                <div className="border-t border-border/50 pt-4 space-y-4">
                    <button
                        type="button"
                        onClick={() => setShowCosts((v) => !v)}
                        aria-expanded={showCosts}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                        <ChevronDown className={cn("w-4 h-4 transition-transform", !showCosts && "-rotate-90")} />
                        Kosten & Abrechnung (optional)
                    </button>
                    {showCosts && <MeterCostFields form={form} onChange={setForm} idPrefix="new-meter" />}
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </div>
        </BaseDialog>
    );
}
