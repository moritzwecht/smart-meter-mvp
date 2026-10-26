"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { BaseDialog } from "@/components/ui/BaseDialog";
import { addMeter } from "@/lib/offline/repo";
import { cn } from "@/lib/utils";
import { emptyMeterForm, focusFormField, MeterCostFields, meterFieldsFromForm, MeterTypeFields, type MeterFormError, type MeterFormState } from "./MeterForm";

interface AddMeterDialogProps {
    householdId: number;
    isOpen: boolean;
    onClose: () => void;
    onCreated: (meterId: string) => void;
    /** Neue Zähler direkt ans Dashboard heften (solange dort noch nichts ist) */
    pinByDefault?: boolean;
}

export function AddMeterDialog({ householdId, isOpen, onClose, onCreated, pinByDefault = false }: AddMeterDialogProps) {
    const [form, setForm] = useState<MeterFormState>(() => emptyMeterForm());
    const [showCosts, setShowCosts] = useState(false);
    const [error, setError] = useState<MeterFormError | null>(null);

    // Schließen (auch versehentlich per Tipp daneben) verwirft die Eingaben nicht
    const close = () => {
        onClose();
        setError(null);
    };

    const reset = () => {
        setForm(emptyMeterForm());
        setShowCosts(false);
        setError(null);
    };

    const create = async () => {
        const result = meterFieldsFromForm(form);
        if ("error" in result) {
            setError(result);
            if (result.field !== "unit") setShowCosts(true);
            focusFormField("new-meter", result.field);
            return;
        }
        const id = await addMeter(householdId, { ...result.fields, isPinned: pinByDefault });
        onClose();
        reset();
        onCreated(id);
    };

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={close}
            title="Neuer Zähler"
            className="sm:max-w-md"
            footer={
                <div className="space-y-3">
                    {/* Fehler direkt über dem Knopf – sonst liegt er außerhalb des sichtbaren Bereichs */}
                    {error && <Alert variant="error">{error.error}</Alert>}
                    <button type="button" onClick={create} className="w-full btn btn-primary min-h-14 text-sm uppercase tracking-[0.2em] font-black">
                        Zähler anlegen
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                <MeterTypeFields form={form} onChange={setForm} idPrefix="new-meter" invalid={error?.field} />

                <div className="border-t border-border/50 pt-4 space-y-4">
                    <button
                        type="button"
                        onClick={() => setShowCosts((v) => !v)}
                        aria-expanded={showCosts}
                        className="flex items-center gap-2 min-h-11 w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                        <ChevronDown className={cn("w-4 h-4 transition-transform", !showCosts && "-rotate-90")} />
                        Kosten & Abrechnung (optional)
                    </button>
                    {showCosts && <MeterCostFields form={form} onChange={setForm} idPrefix="new-meter" invalid={error?.field} />}
                </div>
            </div>
        </BaseDialog>
    );
}
