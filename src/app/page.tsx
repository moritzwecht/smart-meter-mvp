"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, LogOut, Trash2, Users, Settings, X, Check, Edit2, History, Zap, ListTodo, FileText, Mail, User, UserMinus } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { logout as logoutAction, getHouseholds as getHouseholdsAction, createHousehold as createHouseholdAction, deleteHousehold as deleteHouseholdAction, removeMember as removeMemberAction, getMeters, getTodoLists, getNotes, addNote, addMeter, addTodoList, updateNote, deleteNote, updateTodoList, deleteTodoList, addTodoItem, toggleTodoItem, deleteTodoItem, updateMeter, deleteMeter, addReading, deleteReading, inviteToHousehold, getHouseholdMembers } from "./actions";

interface Session {
  email: string;
  expires: string;
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdMenuOpen, setIsHouseholdMenuOpen] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [widgets, setWidgets] = useState<any[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editingList, setEditingList] = useState<any | null>(null);
  const [editingMeter, setEditingMeter] = useState<any | null>(null);
  const [newItemValue, setNewItemValue] = useState("");

  const refreshHouseholds = async () => {
    const data = await getHouseholdsAction();
    setHouseholds(data);
    if (data.length > 0 && !selectedHouseholdId) {
      setSelectedHouseholdId(data[0].id);
    }
  };

  const refreshMembers = async (hId: number) => {
    try {
      const data = await getHouseholdMembers(hId);
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  const refreshWidgets = async (hId: number) => {
    const [m, l, n] = await Promise.all([
      getMeters(hId),
      getTodoLists(hId),
      getNotes(hId)
    ]);

    const allWidgets = [
      ...m.map(i => ({ ...i, widgetType: 'METER' })),
      ...l.map(i => ({ ...i, widgetType: 'LIST' })),
      ...n.map(i => ({ ...i, widgetType: 'NOTE' }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setWidgets(allWidgets);

    // If we're currently editing a list, update its local state too
    if (editingList) {
      const updatedList = l.find(list => list.id === editingList.id);
      if (updatedList) setEditingList(updatedList);
    }

    // If we're currently editing a meter, update its local state too
    if (editingMeter) {
      const updatedMeter = m.find(meter => meter.id === editingMeter.id);
      if (updatedMeter) setEditingMeter(updatedMeter);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setSession(data.session);
        if (data.session) refreshHouseholds();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedHouseholdId) {
      refreshWidgets(selectedHouseholdId);

      const interval = setInterval(() => {
        refreshWidgets(selectedHouseholdId);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedHouseholdId]);

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    await createHouseholdAction(newHouseholdName);
    setNewHouseholdName("");
    setIsHouseholdMenuOpen(false);
    refreshHouseholds();
  };

  if (loading) return null;

  if (!session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-foreground">HOME</h1>
            <p className="text-sm text-muted-foreground font-mono">v0.1.0</p>
          </div>
          <div className="card shadow-xl shadow-foreground/5">
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      <header className="flex justify-between items-center py-4 border-b border-border mb-8">
        <div className="relative">
          <button
            onClick={() => setIsHouseholdMenuOpen(!isHouseholdMenuOpen)}
            className="group flex items-center gap-2 text-2xl font-black tracking-tighter hover:text-muted-foreground transition-colors"
          >
            {selectedHousehold ? selectedHousehold.name : "Wähle Haushalt"}
            <motion.div
              animate={{ rotate: isHouseholdMenuOpen ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ChevronDown className="w-5 h-5 opacity-50" />
            </motion.div>
          </button>

          <AnimatePresence>
            {isHouseholdMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 mt-4 w-72 bg-card border border-border shadow-2xl rounded-xl z-50 p-2 space-y-2 overflow-hidden"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 py-2 border-b border-border/50">
                  Deine Haushalte
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {households.map(h => (
                    <div key={h.id} className="flex group px-1">
                      <button
                        onClick={() => {
                          setSelectedHouseholdId(h.id);
                          setIsHouseholdMenuOpen(false);
                        }}
                        className={`flex-1 text-left px-3 py-2 rounded-lg font-medium text-sm transition-colors ${h.id === selectedHouseholdId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                      >
                        {h.name}
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`Möchtest du "${h.name}" wirklich löschen?`)) {
                            try {
                              await deleteHouseholdAction(h.id);
                              if (selectedHouseholdId === h.id) setSelectedHouseholdId(null);
                              refreshHouseholds();
                            } catch (err: any) {
                              alert(err.message);
                            }
                          }
                        }}
                        className={`p-2 hover:text-red-500 transition-colors ${h.role !== 'OWNER' ? 'hidden' : ''}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border mt-2 pt-2 px-2">
                  <form onSubmit={handleCreateHousehold} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Neuer Haushalt..."
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      className="w-full text-sm bg-transparent border-none focus:ring-0 px-2 py-1 outline-none"
                    />
                    <button type="submit" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 pb-2 text-left">
                      + Haushalt hinzufügen
                    </button>
                  </form>
                </div>

                {selectedHouseholdId && selectedHousehold?.role === 'OWNER' && (
                  <button
                    onClick={() => {
                      setShowManageMembers(true);
                      setIsHouseholdMenuOpen(false);
                      refreshMembers(selectedHouseholdId);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2.5 bg-accent/30 hover:bg-accent transition-colors text-xs font-bold border-t border-border"
                  >
                    <Users className="w-4 h-4" />
                    Mitglieder verwalten
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={async () => {
            await logoutAction();
            setSession(null);
          }}
          className="btn btn-ghost flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Abmelden</span>
        </button>
      </header>

      {selectedHousehold ? (
        <div className="space-y-8">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] opacity-30">Dashboard</h2>
            <button
              onClick={() => setShowAddWidget(!showAddWidget)}
              className="btn btn-primary flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <Plus className={`w-4 h-4 transition-transform ${showAddWidget ? 'rotate-45' : ''}`} />
              {showAddWidget ? "Abbrechen" : "Hinzufügen"}
            </button>
          </div>

          <AnimatePresence>
            {showAddWidget && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-8">
                  {[
                    { type: 'METER', icon: <Zap className="w-5 h-5" />, label: 'Zähler', desc: 'Strom, Gas, Wasser' },
                    { type: 'LIST', icon: <ListTodo className="w-5 h-5" />, label: 'Liste', desc: 'Aufgaben & Pläne' },
                    { type: 'NOTE', icon: <FileText className="w-5 h-5" />, label: 'Notiz', desc: 'Schnelle Gedanken' },
                  ].map(opt => (
                    <motion.button
                      key={opt.type}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        if (opt.type === 'NOTE') await addNote(selectedHouseholdId!, "Neue Notiz");
                        if (opt.type === 'METER') await addMeter(selectedHouseholdId!, "Neuer Zähler", "ELECTRICITY", "kWh");
                        if (opt.type === 'LIST') await addTodoList(selectedHouseholdId!, "Neue Liste");
                        setShowAddWidget(false);
                        refreshWidgets(selectedHouseholdId!);
                      }}
                      className="card hover:border-primary/50 group text-left flex flex-col items-start gap-4"
                    >
                      <div className="p-3 rounded-xl bg-accent group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {opt.icon}
                      </div>
                      <div>
                        <div className="font-bold text-sm uppercase tracking-tight">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {widgets.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                  className="card group flex flex-col gap-6 shadow-sm hover:shadow-xl hover:shadow-foreground/5 transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 px-2 py-1 bg-accent rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {w.widgetType === 'METER' && <Zap className="w-3 h-3" />}
                      {w.widgetType === 'LIST' && <ListTodo className="w-3 h-3" />}
                      {w.widgetType === 'NOTE' && <FileText className="w-3 h-3" />}
                      {w.widgetType}
                    </div>
                    <div className="text-[10px] font-mono opacity-30 uppercase">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">{w.name || w.title}</h3>
                    {w.widgetType === 'NOTE' && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                        {w.content || "Kein Inhalt..."}
                      </p>
                    )}
                    {w.widgetType === 'LIST' && (
                      <div className="mt-4 space-y-2">
                        {w.items?.slice(0, 3).map((item: any) => (
                          <div key={item.id} className="text-xs flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 ${item.completed === 'true' ? 'bg-primary text-primary-foreground border-primary' : ''}`}>
                              {item.completed === 'true' && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span className={`line-clamp-1 ${item.completed === 'true' ? 'line-through opacity-40' : 'text-foreground/80'}`}>
                              {item.content}
                            </span>
                          </div>
                        ))}
                        {w.items?.length > 3 && (
                          <div className="text-[10px] text-muted-foreground mt-2 font-medium">
                            +{w.items.length - 3} weitere Punkte
                          </div>
                        )}
                        {(!w.items || w.items.length === 0) && (
                          <p className="text-xs text-muted-foreground/50 italic">Keine Punkte vorhanden</p>
                        )}
                      </div>
                    )}
                    {w.widgetType === 'METER' && (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-foreground">
                            {w.readings?.length > 0 ? (
                              w.readings.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].value
                            ) : "0"}
                          </span>
                          <span className="text-sm font-bold text-muted-foreground uppercase">{w.unit}</span>
                        </div>

                        {w.readings?.length >= 2 && (() => {
                          const sorted = [...w.readings].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          const first = sorted[0];
                          const last = sorted[sorted.length - 1];
                          const diff = parseFloat(last.value) - parseFloat(first.value);
                          const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
                          if (days > 0) {
                            const avg = (diff / days).toFixed(2);
                            return (
                              <div className="flex items-center gap-2 mt-2 py-2 border-t border-border/50">
                                <div className="p-1 rounded bg-green-500/10 text-green-600">
                                  <History className="w-3 h-3" />
                                </div>
                                <span className="text-[11px] font-bold text-green-600 uppercase tracking-wider">
                                  Ø {avg} {w.unit} / Tag
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border flex justify-between items-center bg-card">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (w.widgetType === 'NOTE') setEditingNote(w);
                          if (w.widgetType === 'LIST') setEditingList(w);
                          if (w.widgetType === 'METER') setEditingMeter(w);
                        }}
                        className="btn btn-ghost px-2 py-1 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3 h-3" />
                        Bearbeiten
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (window.confirm("Wirklich löschen?")) {
                          if (w.widgetType === 'NOTE') await deleteNote(w.id);
                          if (w.widgetType === 'LIST') await deleteTodoList(w.id);
                          if (w.widgetType === 'METER') await deleteMeter(w.id);
                          refreshWidgets(selectedHouseholdId!);
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {widgets.length === 0 && !showAddWidget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-24 flex flex-col items-center justify-center text-center gap-6"
              >
                <div className="w-16 h-16 rounded-3xl bg-accent flex items-center justify-center">
                  <Plus className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">Keine Widgets vorhanden</p>
                  <p className="text-xs text-muted-foreground">Erstelle dein erstes Widget, um loszulegen.</p>
                </div>
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="btn btn-primary text-xs uppercase tracking-widest"
                >
                  Widget erstellen
                </button>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-24 text-center border-2 border-dashed border-black/20">
          <p className="font-bold uppercase tracking-widest opacity-30">Wähle oder erstelle einen Haushalt</p>
        </div>
      )}

      <AnimatePresence>
        {editingNote && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Notiz bearbeiten</h2>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Titel</label>
                  <input
                    type="text"
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full text-2xl font-black bg-transparent border-none focus:ring-0 p-0 outline-none placeholder:opacity-20"
                    placeholder="Titel der Notiz"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Inhalt</label>
                  <textarea
                    rows={8}
                    value={editingNote.content || ""}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="w-full bg-accent/30 rounded-xl p-4 outline-none focus:bg-accent/50 transition-colors resize-none text-sm leading-relaxed"
                    placeholder="Schreibe etwas..."
                  />
                </div>
              </div>

              <div className="p-6 bg-accent/20 border-t border-border flex gap-3">
                <button
                  onClick={async () => {
                    await updateNote(editingNote.id, editingNote.title, editingNote.content);
                    setEditingNote(null);
                    refreshWidgets(selectedHouseholdId!);
                  }}
                  className="flex-1 btn btn-primary py-3"
                >
                  Speichern
                </button>
                <button
                  onClick={() => setEditingNote(null)}
                  className="flex-1 btn btn-ghost py-3"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingList && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Liste bearbeiten</h2>
                <button
                  onClick={() => setEditingList(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Name der Liste</label>
                  <input
                    type="text"
                    value={editingList.name}
                    onChange={async (e) => {
                      setEditingList({ ...editingList, name: e.target.value });
                    }}
                    onBlur={async () => {
                      await updateTodoList(editingList.id, editingList.name);
                      refreshWidgets(selectedHouseholdId!);
                    }}
                    className="w-full text-2xl font-black bg-transparent border-none focus:ring-0 p-0 outline-none"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Listenpunkte</label>

                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {editingList.items?.map((item: any) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl group transition-colors hover:bg-accent/50"
                        >
                          <button
                            onClick={async () => {
                              const newStatus = item.completed === 'true' ? 'false' : 'true';
                              await toggleTodoItem(item.id, newStatus);
                              refreshWidgets(selectedHouseholdId!);
                            }}
                            className={`w-6 h-6 rounded-lg border-2 border-border flex items-center justify-center transition-all ${item.completed === 'true' ? 'bg-primary border-primary text-primary-foreground transform scale-105' : 'hover:border-primary'}`}
                          >
                            {item.completed === 'true' && <Check className="w-4 h-4" />}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${item.completed === 'true' ? 'line-through opacity-40' : 'text-foreground'}`}>
                            {item.content}
                          </span>
                          <button
                            onClick={async () => {
                              await deleteTodoItem(item.id);
                              refreshWidgets(selectedHouseholdId!);
                            }}
                            className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newItemValue.trim()) return;
                        await addTodoItem(editingList.id, newItemValue);
                        setNewItemValue("");
                        refreshWidgets(selectedHouseholdId!);
                      }}
                      className="flex gap-2 mt-4"
                    >
                      <input
                        type="text"
                        placeholder="Neuer Punkt..."
                        value={newItemValue}
                        onChange={(e) => setNewItemValue(e.target.value)}
                        className="flex-1 bg-accent/20 rounded-xl px-4 py-3 text-sm outline-none focus:bg-accent/40 transition-colors"
                      />
                      <button type="submit" className="btn btn-primary px-6">
                        <Plus className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-accent/10">
                <button
                  onClick={() => setEditingList(null)}
                  className="w-full btn btn-primary py-3"
                >
                  Fertig
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingMeter && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Zähler bearbeiten</h2>
                <button
                  onClick={() => setEditingMeter(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Name</label>
                    <input
                      type="text"
                      value={editingMeter.name}
                      onChange={(e) => setEditingMeter({ ...editingMeter, name: e.target.value })}
                      onBlur={() => {
                        updateMeter(editingMeter.id, editingMeter.name, editingMeter.unit);
                        refreshWidgets(selectedHouseholdId!);
                      }}
                      className="w-full text-lg font-black bg-transparent border-b-2 border-border focus:border-primary outline-none py-1 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Einheit</label>
                    <input
                      type="text"
                      value={editingMeter.unit}
                      onChange={(e) => setEditingMeter({ ...editingMeter, unit: e.target.value })}
                      onBlur={() => {
                        updateMeter(editingMeter.id, editingMeter.name, editingMeter.unit);
                        refreshWidgets(selectedHouseholdId!);
                      }}
                      className="w-full text-lg font-black bg-transparent border-b-2 border-border focus:border-primary outline-none py-1 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Statistik</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editingMeter.readings?.length >= 2 ? (() => {
                      const sorted = [...editingMeter.readings].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const first = sorted[0];
                      const last = sorted[sorted.length - 1];
                      const diff = parseFloat(last.value) - parseFloat(first.value);
                      const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
                      const avg = days > 0 ? (diff / days).toFixed(2) : "0.00";
                      return (
                        <>
                          <div className="p-4 bg-accent/30 rounded-2xl space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Gesamtverbrauch</div>
                            <div className="text-2xl font-black">{diff.toFixed(2)} {editingMeter.unit}</div>
                            <div className="text-[10px] opacity-40">über {Math.floor(days)} Tage</div>
                          </div>
                          <div className="p-4 bg-green-500/5 rounded-2xl space-y-1 border border-green-500/10">
                            <div className="text-[10px] uppercase font-bold text-green-600/60">Tagesdurchschnitt</div>
                            <div className="text-2xl font-black text-green-600">{avg} {editingMeter.unit}</div>
                            <div className="text-[10px] text-green-600/40">pro 24 Stunden</div>
                          </div>
                        </>
                      );
                    })() : (
                      <div className="col-span-full p-8 text-center bg-accent/20 rounded-2xl border border-dashed border-border text-xs text-muted-foreground italic">
                        Mindestens zwei Ablesungen für Statistik benötigt...
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Neuer Zählerstand</label>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newItemValue.trim()) return;
                      await addReading(editingMeter.id, newItemValue, new Date());
                      setNewItemValue("");
                      refreshWidgets(selectedHouseholdId!);
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={newItemValue}
                        onChange={(e) => setNewItemValue(e.target.value)}
                        className="w-full bg-accent/20 rounded-xl px-4 py-4 text-2xl font-black outline-none focus:bg-accent/40 transition-colors"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground uppercase">
                        {editingMeter.unit}
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary px-8">
                      Speichern
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Verlauf</label>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                    {editingMeter.readings && editingMeter.readings.length > 0 ? (
                      editingMeter.readings
                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((r: any) => (
                          <div key={r.id} className="flex justify-between items-center p-4 hover:bg-accent/20 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                <History className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="text-sm font-black">{r.value} {editingMeter.unit}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{new Date(r.date).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (window.confirm("Ablesung löschen?")) {
                                  await deleteReading(r.id);
                                  refreshWidgets(selectedHouseholdId!);
                                }
                              }}
                              className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                    ) : (
                      <div className="p-12 text-center text-xs text-muted-foreground italic">Noch keine Ablesungen vorhanden...</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-accent/10">
                <button
                  onClick={() => setEditingMeter(null)}
                  className="w-full btn btn-primary py-3"
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Member Management Overlay */}
      <AnimatePresence>
        {showManageMembers && selectedHousehold && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight">Mitglieder verwalten</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Haushalt: {selectedHousehold.name}</p>
                </div>
                <button
                  onClick={() => setShowManageMembers(false)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Neues Mitglied einladen</label>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selectedHouseholdId) return;
                      setInviteError("");
                      try {
                        await inviteToHousehold(selectedHouseholdId, inviteEmail);
                        setInviteEmail("");
                        refreshMembers(selectedHouseholdId);
                      } catch (err: any) {
                        setInviteError(err.message || "Fehler beim Einladen.");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        placeholder="email@beispiel.de"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full bg-accent/20 rounded-xl pl-11 pr-4 py-4 text-sm outline-none focus:bg-accent/40 transition-colors"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary px-8">
                      Einladen
                    </button>
                  </form>
                  {inviteError && <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">{inviteError}</p>}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Aktuelle Mitglieder</label>
                    <span className="text-[10px] font-mono opacity-30">{members.length} Person(en)</span>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                    {members.map((m, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 hover:bg-accent/10 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center border border-border">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-sm font-black flex items-center gap-2">
                              {m.email}
                              {m.role === 'OWNER' && (
                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest rounded leading-none">Inhaber</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {m.email !== session.email && m.role !== 'OWNER' && (
                          <button
                            onClick={async () => {
                              if (selectedHouseholdId && window.confirm(`${m.email} wirklich aus dem Haushalt entfernen?`)) {
                                await removeMemberAction(selectedHouseholdId, m.email);
                                refreshMembers(selectedHouseholdId);
                              }
                            }}
                            className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border bg-accent/10">
                <button
                  onClick={() => setShowManageMembers(false)}
                  className="w-full btn btn-primary py-3"
                >
                  Fertig
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
