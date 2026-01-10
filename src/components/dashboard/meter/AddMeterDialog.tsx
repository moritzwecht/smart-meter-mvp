"use client";

import { Zap, Droplets, Flame } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { BaseDialog } from "@/components/ui/BaseDialog";

interface AddMeterDialogProps {
    isOpen: boolean;
    onClose: () => void;
    newMeterData: any;
    setNewMeterData: (data: any) => void;
    onAdd: () => void;
    isPending?: boolean;
}

export function AddMeterDialog({
    isOpen,
    onClose,
    newMeterData,
    setNewMeterData,
    onAdd,
    isPending,
}: AddMeterDialogProps) {
    const types = [
        { type: "ELECTRICITY", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", label: "Strom" },
        { type: "WATER", icon: Droplets, color: "text-blue-500", bg: "bg-blue-500/10", label: "Wasser" },
        { type: "GAS", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", label: "Gas" },
    ] as const;

    const units = ["kWh", "m³", "l"];

    return (
        <BaseDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Neuer Zähler"
            className="sm:max-w-sm"
            footer={
                <button
                    onClick={onAdd}
                    disabled={isPending}
                    className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black disabled:opacity-70"
                >
                    {isPending ? <Spinner className="text-primary-foreground" size={20} /> : "Erstellen"}
                </button>
            }
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Typ</label>
                        <div className="grid grid-cols-3 gap-2">
                            {types.map((t) => (
                                <button
                                    key={t.type}
                                    onClick={() => setNewMeterData({ ...newMeterData, type: t.type })}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newMeterData.type === t.type
                                        ? "border-primary bg-primary/5"
                                        : "border-transparent bg-accent/30 hover:bg-accent/50"
                                        } `}
                                >
                                    <t.icon className={`w-6 h-6 ${t.color}`} />
                                    <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Einheit</label>
                        <div className="flex flex-wrap gap-2">
                            {units.map((u) => (
                                <button
                                    key={u}
                                    onClick={() => setNewMeterData({ ...newMeterData, unit: u })}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newMeterData.unit === u
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "bg-accent/50 hover:bg-accent text-muted-foreground"
                                        } `}
                                >
                                    {u}
                                </button>
                            ))}
                            <div className="relative flex-1 min-w-[100px]">
                                <input
                                    type="text"
                                    placeholder="Andere..."
                                    value={units.includes(newMeterData.unit) ? "" : newMeterData.unit}
                                    onChange={(e) => setNewMeterData({ ...newMeterData, unit: e.target.value })}
                                    className={`w-full input-field font-bold ${!units.includes(newMeterData.unit) && newMeterData.unit !== ""
                                        ? "border-primary/50"
                                        : ""
                                        } `}
                                />
                            </div>
                        </div>
                    </div>

                    {(newMeterData.type === "ELECTRICITY" || newMeterData.type === "GAS") && (
                        <div className="pt-4 border-t border-border/50 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                                Kosten & Einstellungen
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Abschlag (Monat)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={newMeterData.monthlyPayment || ""}
                                            onChange={(e) => setNewMeterData({ ...newMeterData, monthlyPayment: e.target.value })}
                                            placeholder="0.00"
                                            className="input-field w-full pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">€</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Verbrauchspreis</label>
                                        {newMeterData.type === "GAS" && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setNewMeterData({ ...newMeterData, priceUnit: newMeterData.unit })}
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${(!newMeterData.priceUnit || newMeterData.priceUnit === newMeterData.unit) ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}
                                                >
                                                    €/{newMeterData.unit}
                                                </button>
                                                <button
                                                    onClick={() => setNewMeterData({ ...newMeterData, priceUnit: "kwh" })}
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${newMeterData.priceUnit === "kwh" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}
                                                >
                                                    €/kWh
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={newMeterData.pricePerUnit || ""}
                                            onChange={(e) => setNewMeterData({ ...newMeterData, pricePerUnit: e.target.value })}
                                            placeholder="0.000"
                                            className="input-field w-full pr-16"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                                            €/{newMeterData.priceUnit === "kwh" ? "kWh" : newMeterData.unit}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Grundgebühr (in Abschlag)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={newMeterData.basicFee || ""}
                                            onChange={(e) => setNewMeterData({ ...newMeterData, basicFee: e.target.value })}
                                            placeholder="0.00"
                                            className="input-field w-full pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">€</span>
                                    </div>
                                </div>

                                {newMeterData.type === "GAS" && newMeterData.unit === "m³" && newMeterData.priceUnit === "kwh" && (
                                    <>
                                        <div className="col-span-full pt-2">
                                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-500">
                                                <p className="font-bold mb-1">Hinweis zur Umrechnung</p>
                                                Da dein Zähler in {newMeterData.unit} misst, der Preis aber in kWh ist, benötigen wir zur Umrechnung folgende Werte (stehen auf der Rechnung).
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Zustandszahl</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={newMeterData.zNumber || ""}
                                                onChange={(e) => setNewMeterData({ ...newMeterData, zNumber: e.target.value })}
                                                placeholder="z.B. 0.95"
                                                className="input-field w-full"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Brennwert</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={newMeterData.calorificValue || ""}
                                                onChange={(e) => setNewMeterData({ ...newMeterData, calorificValue: e.target.value })}
                                                placeholder="z.B. 11.2"
                                                className="input-field w-full"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BaseDialog>
    );
}
