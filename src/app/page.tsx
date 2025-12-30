"use client";

import { useState, useEffect } from "react";
import { Plus, Bell, TrendingUp, Zap, Flame, Droplets, BellOff, Settings } from "lucide-react";
import { MeterCard } from "@/components/MeterCard";
import { AddReadingDialog } from "@/components/AddReadingDialog";
import { AddMeterDialog } from "@/components/AddMeterDialog";
import { getMeters, addReading, addMeter, deleteMeter, updateMeter } from "./actions";
import { calculateStats } from "@/lib/calculations";
import { formatCurrency, cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { subscribeUserToPush, checkPushPermission } from "@/lib/push";

export default function Dashboard() {
  const [meters, setMeters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddReadingOpen, setIsAddReadingOpen] = useState(false);
  const [isAddMeterOpen, setIsAddMeterOpen] = useState(false);
  const [selectedMeterForReading, setSelectedMeterForReading] = useState<any | null>(null);
  const [editingMeter, setEditingMeter] = useState<any | null>(null);
  const [pushPermission, setPushPermission] = useState<string>("default");

  const loadMeters = async () => {
    setLoading(true);
    try {
      const data = await getMeters();
      setMeters(data);
      const permission = await checkPushPermission();
      setPushPermission(permission);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      await subscribeUserToPush();
      setPushPermission("granted");
    } catch (e) {
      console.error("Failed to subscribe:", e);
      alert("Fehler beim Aktivieren der Benachrichtigungen.");
    }
  };

  useEffect(() => {
    loadMeters();
  }, []);

  const totalMonthlyCost = meters.reduce((acc, meter) => {
    const stats = calculateStats(meter.type, meter.readings, meter.monthlyPayment, meter.unitPrice);
    return acc + (stats?.costPrognosisMonthly || 0);
  }, 0);

  const totalMonthlyPayments = meters.reduce((acc, meter) => {
    return acc + (meter.monthlyPayment || 0);
  }, 0);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ArmbrustTracker</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleEnableNotifications}
              className={cn(
                "p-3 rounded-xl transition-all active:scale-95 flex items-center gap-2",
                pushPermission === "granted"
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
              )}
              title={pushPermission === "granted" ? "Benachrichtigungen aktiv" : "Benachrichtigungen aktivieren"}
            >
              {pushPermission === "granted" ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setEditingMeter(null);
                setIsAddMeterOpen(true);
              }}
              className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Summary Card */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-[2.5rem] p-8 mb-12 flex flex-col md:flex-row justify-center items-center gap-12"
        >
          <div className="flex flex-col gap-2 items-center md:items-start">
            <p className="text-sm font-medium text-foreground/40 uppercase tracking-widest">Monatliche Kosten (Prognose)</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-5xl font-black">{formatCurrency(totalMonthlyCost)}</h2>
              <p className="text-lg text-foreground/40">/ Monat</p>
            </div>
          </div>

          <div className="h-px md:h-12 w-full md:w-px bg-foreground/10" />

          <div className="flex flex-col gap-2 items-center md:items-start">
            <p className="text-sm font-medium text-foreground/40 uppercase tracking-widest">Abschlagszahlungen</p>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold">{formatCurrency(totalMonthlyPayments)}</h2>
            </div>
          </div>
        </motion.div> */}

        {/* Meters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="glass rounded-3xl h-80 animate-pulse" />
            ))
          ) : meters.length > 0 ? (
            meters.map((meter) => {
              const stats = calculateStats(meter.type, meter.readings, meter.monthlyPayment, meter.unitPrice);
              const lastReading = meter.readings && meter.readings.length > 0 ? meter.readings[0] : null;

              return (
                <MeterCard
                  key={meter.id}
                  id={meter.id}
                  name={meter.name}
                  type={meter.type}
                  unit={meter.unit}
                  lastReading={lastReading?.value}
                  lastReadingDate={lastReading ? new Date(lastReading.date) : undefined}
                  stats={stats}
                  onAddReading={() => {
                    setSelectedMeterForReading(meter);
                    setIsAddReadingOpen(true);
                  }}
                  onEdit={() => {
                    setEditingMeter(meter);
                    setIsAddMeterOpen(true);
                  }}
                />
              );
            })
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-6">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center">
                <Settings className="w-12 h-12 text-slate-300 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Noch keine Zähler</h3>
                <p className="text-foreground/40 max-w-sm mt-2">
                  Lege deinen ersten Strom-, Gas- oder Wasserzähler an, um deinen Verbrauch zu tracken.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingMeter(null);
                  setIsAddMeterOpen(true);
                }}
                className="px-8 py-4 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
              >
                <Plus className="w-5 h-5" />
                Zähler hinzufügen
              </button>
            </div>
          )}
        </div>
      </div>

      <AddReadingDialog
        isOpen={isAddReadingOpen}
        onClose={() => setIsAddReadingOpen(false)}
        meter={selectedMeterForReading}
        onSave={async (id, val) => {
          await addReading(id, val);
          loadMeters();
        }}
      />

      <AddMeterDialog
        isOpen={isAddMeterOpen}
        onClose={() => setIsAddMeterOpen(false)}
        initialData={editingMeter}
        onDelete={async () => {
          if (editingMeter) {
            await deleteMeter(editingMeter.id);
            loadMeters();
          }
        }}
        onSave={async (data) => {
          if (editingMeter) {
            await updateMeter(editingMeter.id, data);
          } else {
            await addMeter(data);
          }
          loadMeters();
        }}
      />
    </main>
  );
}
