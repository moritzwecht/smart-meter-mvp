import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { parseSafe, formatNumber } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface MeterReadingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    meter: any;
    value: string;
    setValue: (val: string) => void;
    onSave: (e: React.FormEvent) => void;
    onOpenSettings: () => void;
    isPending?: boolean;
}

export function MeterReadingDialog({
    isOpen,
    onClose,
    meter,
    value,
    setValue,
    onSave,
    onOpenSettings,
    isPending,
}: MeterReadingDialogProps) {
    const [lastMeter, setLastMeter] = useState(meter);
    useEffect(() => {
        if (meter) setLastMeter(meter);
    }, [meter]);

    const activeMeter = meter || lastMeter;

    if (!activeMeter) return null;

    const sortedReadings = [...(activeMeter.readings || [])].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastReading = sortedReadings[0];

    const typeLabel =
        { ELECTRICITY: "Strom", WATER: "Wasser", GAS: "Gas" }[
        activeMeter.type as "ELECTRICITY" | "WATER" | "GAS"
        ] || "Zähler";

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title={typeLabel}
            className="sm:max-w-sm"
            footer={
                <div className="text-center">
                    <button
                        onClick={onOpenSettings}
                        className="inline-flex items-center gap-2 py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded-lg"
                    >
                        <Settings className="w-3 h-3" />
                        Einstellungen & Verlauf
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    {lastReading && (
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            <span>Letzter Stand</span>
                            <span>
                                {formatNumber(parseSafe(lastReading.value), 2)} {activeMeter.unit} (
                                {new Date(lastReading.date).toLocaleDateString()})
                            </span>
                        </div>
                    )}

                    <form onSubmit={onSave} className="space-y-4">
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={value}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9,.]/g, "");
                                    setValue(val);
                                }}
                                className="w-full input-field py-5 text-4xl font-black tabular-nums"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground uppercase">
                                {activeMeter.unit}
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black disabled:opacity-70"
                        >
                            {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Speichern"}
                        </button>
                    </form>
                </div>
            </div>
        </BaseDialog>
    );
}
