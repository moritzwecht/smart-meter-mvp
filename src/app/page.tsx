"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, LogOut, Trash2, Users, Settings, X, Check, Edit2, History, Zap, Droplets, Flame, ListTodo, FileText, Mail, User, UserMinus, Sun, Moon } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { logout as logoutAction, getHouseholds as getHouseholdsAction, createHousehold as createHouseholdAction, updateHousehold as updateHouseholdAction, deleteHousehold as deleteHouseholdAction, removeMember as removeMemberAction, getMeters, getTodoLists, getNotes, addNote, addMeter, addTodoList, updateNote, deleteNote, updateTodoList, deleteTodoList, addTodoItem, toggleTodoItem, deleteTodoItem, updateMeter, deleteMeter, addReading, deleteReading, inviteToHousehold, getHouseholdMembers, updateProfile, getUserProfile } from "./actions";

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
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [widgets, setWidgets] = useState<any[]>([]);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editingList, setEditingList] = useState<any | null>(null);
  const [editingMeter, setEditingMeter] = useState<any | null>(null);
  const [addingReadingForMeter, setAddingReadingForMeter] = useState<any | null>(null);
  const [showAddMeterDialog, setShowAddMeterDialog] = useState(false);
  const [newMeterData, setNewMeterData] = useState({ name: "Neuer Zähler", type: "ELECTRICITY", unit: "kWh" });
  const [editingHousehold, setEditingHousehold] = useState<any | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [newItemValue, setNewItemValue] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ email: string; name: string } | null>(null);
  const [profileData, setProfileData] = useState({ name: "", currentPassword: "", newPassword: "" });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

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

  const handleRenameHousehold = async () => {
    if (!editingHousehold || !editingHousehold.name.trim()) return;
    try {
      await updateHouseholdAction(editingHousehold.id, editingHousehold.name);
      refreshHouseholds();
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Apply theme to document element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const refreshProfile = async () => {
    const data = await getUserProfile();
    if (data) {
      setUserProfile(data);
      setProfileData(prev => ({ ...prev, name: data.name }));
    }
  };

  useEffect(() => {
    if (session) {
      refreshProfile();
    }
  }, [session]);

  const refreshWidgets = async (householdId: number) => {
    const [m, l, n] = await Promise.all([
      getMeters(householdId),
      getTodoLists(householdId),
      getNotes(householdId)
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

    // If we're currently adding a reading, update its local state too
    if (addingReadingForMeter) {
      const updatedMeter = m.find(meter => meter.id === addingReadingForMeter.id);
      if (updatedMeter) setAddingReadingForMeter(updatedMeter);
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
      <main className="min-h-screen flex flex-col items-center justify-center p-3 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-foreground">HOME</h1>
            <p className="text-sm text-muted-foreground font-mono">v1.2.1</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border border-border p-3 shadow-xl shadow-foreground/5">
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      <header className="flex justify-between items-center py-4 border-b border-border mb-4">
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
                          setEditingHousehold(h);
                          setIsHouseholdMenuOpen(false);
                          refreshMembers(h.id);
                        }}
                        className={`p-2 hover:text-primary transition-colors ${h.role !== 'OWNER' ? 'hidden' : ''}`}
                      >
                        <Edit2 className="w-4 h-4" />
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
            title={theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2"
            title="Profil & Einstellungen"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">{userProfile?.name}</span>
          </button>
        </div>
      </header>

      {selectedHousehold ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] opacity-30"></h2>
            <button
              onClick={() => setShowAddWidget(!showAddWidget)}
              className="btn btn-primary flex items-center gap-2 text-xs uppercase tracking-widest"
            >
              <Plus className={`w-4 h-4 transition-transform ${showAddWidget ? 'rotate-45' : ''} `} />
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
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        if (opt.type === 'NOTE') await addNote(selectedHouseholdId!, "Neue Notiz");
                        if (opt.type === 'METER') {
                          setNewMeterData({ name: "Neuer Zähler", type: "ELECTRICITY", unit: "kWh" });
                          setShowAddMeterDialog(true);
                        }
                        if (opt.type === 'LIST') await addTodoList(selectedHouseholdId!, "Neue Liste");
                        setShowAddWidget(false);
                        refreshWidgets(selectedHouseholdId!);
                      }}
                      className="bg-card text-card-foreground rounded-lg border border-border p-3 hover:border-primary/50 group text-left flex flex-col items-start gap-3"
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

          {widgets.length > 0 ? (
            <div className="space-y-12">
              {/* Meters Section */}
              {widgets.some(w => w.widgetType === 'METER') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {widgets.filter(w => w.widgetType === 'METER').map((w) => (
                        <motion.div
                          key={w.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-foreground/5"
                        >
                          <div className="flex items-center gap-3">
                            {(() => {
                              const type = w.type || 'ELECTRICITY';
                              const config = {
                                ELECTRICITY: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                                WATER: { icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                GAS: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                              }[type as 'ELECTRICITY' | 'WATER' | 'GAS'] || { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' };

                              return (
                                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                                  <config.icon className={`w-5 h-5 ${config.color}`} />
                                </div>
                              );
                            })()}

                            <div className="flex-1 min-w-0">
                              {(() => {
                                const parseSafe = (val: string) => {
                                  if (!val) return 0;
                                  return parseFloat(val.toString().replace(',', '.'));
                                };
                                const formatNumber = (num: number, digits: number = 2) => {
                                  return new Intl.NumberFormat('de-DE', {
                                    minimumFractionDigits: digits,
                                    maximumFractionDigits: digits
                                  }).format(num);
                                };
                                const sorted = [...(w.readings || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                if (sorted.length >= 2) {
                                  const last = sorted[sorted.length - 1];
                                  const secondLast = sorted[sorted.length - 2];
                                  const diff = parseSafe(last.value) - parseSafe(secondLast.value);
                                  const ms = new Date(last.date).getTime() - new Date(secondLast.date).getTime();
                                  const days = ms / (1000 * 60 * 60 * 24);
                                  const avg = days > 0.04 ? formatNumber(diff / days, 2) : null;
                                  return (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-xl font-black tabular-nums">{avg || "---"}</span>
                                      <span className="text-[10px] font-bold text-muted-foreground">{w.unit}/Tag</span>
                                    </div>
                                  );
                                }
                                return <p className="text-[10px] text-muted-foreground italic uppercase">Daten benötigt...</p>;
                              })()}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setAddingReadingForMeter(w)}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20"
                            >
                              <Plus className="w-3 h-3" />
                              Eintragen
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMeter(w);
                              }}
                              className="p-2 hover:bg-accent rounded-xl transition-colors text-muted-foreground hover:text-primary"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Other Widgets Section */}
              {widgets.some(w => w.widgetType !== 'METER') && (
                <div className="space-y-4">
                  <div className="px-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">Listen & Notizen</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <AnimatePresence mode="popLayout">
                      {widgets.filter(w => w.widgetType !== 'METER').map((w) => (
                        <motion.div
                          key={w.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-card text-card-foreground rounded-lg border border-border group flex flex-col p-3 gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-foreground/5"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2 px-2 py-1 bg-accent rounded-md text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
                              <div className="mt-3 space-y-2">
                                {w.items?.slice(0, 3).map((item: any) => (
                                  <div key={item.id} className="text-xs flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded border border-border flex items-center justify-center shrink-0 ${item.completed === 'true' ? 'bg-primary text-primary-foreground border-primary' : ''} `}>
                                      {item.completed === 'true' && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className={`line-clamp-1 ${item.completed === 'true' ? 'line-through opacity-40' : 'text-foreground/80'} `}>
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
                          </div>

                          <div className="pt-3 border-t border-border flex justify-between items-center bg-card">
                            <button
                              onClick={() => {
                                if (w.widgetType === 'NOTE') setEditingNote(w);
                                if (w.widgetType === 'LIST') setEditingList(w);
                              }}
                              className="btn btn-ghost px-2 py-1 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
                            >
                              <Edit2 className="w-3 h-3" />
                              Bearbeiten
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm("Wirklich löschen?")) {
                                  if (w.widgetType === 'NOTE') await deleteNote(w.id);
                                  if (w.widgetType === 'LIST') await deleteTodoList(w.id);
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
                  </div>
                </div>
              )}
            </div>
          ) : !showAddWidget && (
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
      ) : (
        <div className="py-24 text-center border-2 border-dashed border-black/20">
          <p className="font-bold uppercase tracking-widest opacity-30">Wähle oder erstelle einen Haushalt</p>
        </div>
      )}

      <AnimatePresence>
        {showAddMeterDialog && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Neuer Zähler</h2>
                <button
                  onClick={() => setShowAddMeterDialog(false)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-6">
                <div className="space-y-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Typ</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: 'ELECTRICITY', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Strom' },
                        { type: 'WATER', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Wasser' },
                        { type: 'GAS', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Gas' },
                      ].map((t) => (
                        <button
                          key={t.type}
                          onClick={() => setNewMeterData({ ...newMeterData, type: t.type, name: t.label })}
                          className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newMeterData.type === t.type ? 'border-primary bg-primary/5' : 'border-transparent bg-accent/30 hover:bg-accent/50'} `}
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
                      {['kWh', 'm³', 'l'].map((u) => (
                        <button
                          key={u}
                          onClick={() => setNewMeterData({ ...newMeterData, unit: u })}
                          className={`px - 4 py - 2 rounded - xl text - sm font - bold transition - all ${newMeterData.unit === u ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-accent/50 hover:bg-accent text-muted-foreground'} `}
                        >
                          {u}
                        </button>
                      ))}
                      <div className="relative flex-1 min-w-[100px]">
                        <input
                          type="text"
                          placeholder="Andere..."
                          value={['kWh', 'm³', 'l'].includes(newMeterData.unit) ? "" : newMeterData.unit}
                          onChange={(e) => setNewMeterData({ ...newMeterData, unit: e.target.value })}
                          className={`w-full px-4 py-2 rounded-xl text-sm font-bold bg-accent/30 border-2 transition-all outline-none ${!['kWh', 'm³', 'l'].includes(newMeterData.unit) && newMeterData.unit !== '' ? 'border-primary/50' : 'border-transparent focus:border-primary/30'} `}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    await addMeter(selectedHouseholdId!, newMeterData.name, newMeterData.type, newMeterData.unit);
                    setShowAddMeterDialog(false);
                    refreshWidgets(selectedHouseholdId!);
                  }}
                  className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addingReadingForMeter && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-black tracking-tight uppercase opacity-40">
                    {{ ELECTRICITY: 'Strom', WATER: 'Wasser', GAS: 'Gas' }[addingReadingForMeter.type as 'ELECTRICITY' | 'WATER' | 'GAS'] || 'Zähler'}
                  </h2>
                </div>
                <button
                  onClick={() => setAddingReadingForMeter(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-6">
                {(() => {
                  const formatNumber = (num: number, digits: number = 2) => {
                    return new Intl.NumberFormat('de-DE', {
                      minimumFractionDigits: digits,
                      maximumFractionDigits: digits
                    }).format(num);
                  };
                  const parseSafe = (val: string) => {
                    if (!val) return 0;
                    return parseFloat(val.toString().replace(',', '.'));
                  };
                  const sorted = [...(addingReadingForMeter.readings || [])].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const last = sorted[0];
                  return (
                    <div className="space-y-4">
                      {last && (
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          <span>Letzter Stand</span>
                          <span>{formatNumber(parseSafe(last.value), 2)} {addingReadingForMeter.unit} ({new Date(last.date).toLocaleDateString()})</span>
                        </div>
                      )}

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newItemValue.trim()) return;
                          await addReading(addingReadingForMeter.id, newItemValue, new Date());
                          setNewItemValue("");
                          setAddingReadingForMeter(null);
                          refreshWidgets(selectedHouseholdId!);
                        }}
                        className="space-y-4"
                      >
                        <div className="relative">
                          <input
                            autoFocus
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={newItemValue}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9,.]/g, '');
                              setNewItemValue(val);
                            }}
                            className="w-full bg-accent/20 rounded-xl px-4 py-5 text-4xl font-black outline-none focus:bg-accent/40 transition-colors tabular-nums"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground uppercase">
                            {addingReadingForMeter.unit}
                          </div>
                        </div>
                        <button type="submit" className="w-full btn btn-primary py-4 text-sm uppercase tracking-[0.2em] font-black">
                          Speichern
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </div>

              <div className="p-3 border-t border-border bg-accent/10 text-center">
                <button
                  onClick={() => {
                    const meter = addingReadingForMeter;
                    setAddingReadingForMeter(null);
                    setEditingMeter(meter);
                  }}
                  className="inline-flex items-center gap-2 py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded-lg"
                >
                  <Settings className="w-3 h-3" />
                  Einstellungen & Verlauf
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingNote && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Notiz bearbeiten</h2>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                  aria-label="Schließen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-6 overflow-y-auto">
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

              <div className="p-3 bg-accent/20 border-t border-border flex gap-3">
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Liste bearbeiten</h2>
                <button
                  onClick={() => setEditingList(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
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
                            className={`w - 6 h - 6 rounded - lg border - 2 border - border flex items - center justify - center transition - all ${item.completed === 'true' ? 'bg-primary border-primary text-primary-foreground transform scale-105' : 'hover:border-primary'} `}
                          >
                            {item.completed === 'true' && <Check className="w-4 h-4" />}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${item.completed === 'true' ? 'line-through opacity-40' : 'text-foreground'} `}>
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

              <div className="p-3 border-t border-border bg-accent/10">
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <h2 className="text-xl font-black tracking-tight">Zähler bearbeiten</h2>
                <button
                  onClick={() => setEditingMeter(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Typ</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'ELECTRICITY', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Strom' },
                      { type: 'WATER', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Wasser' },
                      { type: 'GAS', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Gas' },
                    ].map((t) => (
                      <button
                        key={t.type}
                        onClick={() => {
                          setEditingMeter({ ...editingMeter, type: t.type, name: t.label });
                          updateMeter(editingMeter.id, t.label, t.type, editingMeter.unit);
                          refreshWidgets(selectedHouseholdId!);
                        }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${editingMeter.type === t.type ? 'border-primary bg-primary/5' : 'border-transparent bg-accent/30 hover:bg-accent/50'} `}
                      >
                        <t.icon className={`w-6 h-6 ${t.color}`} />
                        <span className="text-[10px] font-bold uppercase">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Einheit</label>
                    <div className="flex flex-wrap gap-2">
                      {['kWh', 'm³', 'l'].map((u) => (
                        <button
                          key={u}
                          onClick={() => {
                            setEditingMeter({ ...editingMeter, unit: u });
                            updateMeter(editingMeter.id, editingMeter.name, editingMeter.type, u);
                            refreshWidgets(selectedHouseholdId!);
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${editingMeter.unit === u ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-accent/50 hover:bg-accent text-muted-foreground'} `}
                        >
                          {u}
                        </button>
                      ))}
                      <div className="relative flex-1 min-w-[120px]">
                        <input
                          type="text"
                          placeholder="Andere..."
                          value={['kWh', 'm³', 'l'].includes(editingMeter.unit) ? "" : editingMeter.unit}
                          onChange={(e) => {
                            setEditingMeter({ ...editingMeter, unit: e.target.value });
                          }}
                          onBlur={() => {
                            updateMeter(editingMeter.id, editingMeter.name, editingMeter.type, editingMeter.unit);
                            refreshWidgets(selectedHouseholdId!);
                          }}
                          className={`w-full px-4 py-2 rounded-xl text-sm font-bold bg-accent/30 border-2 transition-all outline-none ${!['kWh', 'm³', 'l'].includes(editingMeter.unit) && editingMeter.unit !== '' ? 'border-primary/50 bg-card' : 'border-transparent focus:border-primary/30'} `}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Statistik</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editingMeter.readings?.length >= 2 ? (() => {
                      const parseSafe = (val: string) => {
                        if (!val) return 0;
                        return parseFloat(val.toString().replace(',', '.'));
                      };
                      const formatNumber = (num: number, digits: number = 2) => {
                        return new Intl.NumberFormat('de-DE', {
                          minimumFractionDigits: digits,
                          maximumFractionDigits: digits
                        }).format(num);
                      };
                      const sorted = [...editingMeter.readings].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const first = sorted[0];
                      const last = sorted[sorted.length - 1];
                      const diff = parseSafe(last.value) - parseSafe(first.value);
                      const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
                      const avg = days > 0 ? (diff / days) : 0;
                      return (
                        <>
                          <div className="p-3 bg-accent/30 rounded-2xl space-y-1">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Gesamtverbrauch</div>
                            <div className="text-2xl font-black">{formatNumber(diff, 3)} {editingMeter.unit}</div>
                            <div className="text-[10px] opacity-40">über {Math.floor(days)} Tage</div>
                          </div>
                          <div className="p-4 bg-green-500/5 rounded-2xl space-y-1 border border-green-500/10">
                            <div className="text-[10px] uppercase font-bold text-green-600/60">Tagesdurchschnitt</div>
                            <div className="text-2xl font-black text-green-600">{formatNumber(avg, 2)} {editingMeter.unit}</div>
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
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Verlauf</label>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                    {editingMeter.readings && editingMeter.readings.length > 0 ? (
                      editingMeter.readings
                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((r: any) => (
                          <div key={r.id} className="flex justify-between items-center p-3 hover:bg-accent/20 transition-colors group">
                            <div className="flex items-center gap-3">
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

              <div className="p-3 border-t border-border bg-accent/10">
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
      {/* Household Settings Overlay */}
      <AnimatePresence>
        {editingHousehold && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight">Haushalt Einstellungen</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{editingHousehold.name}</p>
                </div>
                <button
                  onClick={() => setEditingHousehold(null)}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                {/* Rename Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Haushalt umbenennen</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingHousehold.name}
                      onChange={(e) => setEditingHousehold({ ...editingHousehold, name: e.target.value })}
                      className="flex-1 bg-accent/20 rounded-xl px-4 py-3 text-sm outline-none focus:bg-accent/40 transition-colors"
                    />
                    <button
                      onClick={handleRenameHousehold}
                      className="btn btn-primary px-6 text-xs uppercase tracking-widest"
                    >
                      Speichern
                    </button>
                  </div>
                </div>

                {/* Members Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Neues Mitglied einladen</label>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setInviteError("");
                      try {
                        await inviteToHousehold(editingHousehold.id, inviteEmail);
                        setInviteEmail("");
                        refreshMembers(editingHousehold.id);
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
                    <button type="submit" className="btn btn-primary px-8 text-xs">
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
                      <div key={idx} className="flex justify-between items-center p-3 hover:bg-accent/10 transition-colors group">
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

                        {session && m.email !== session.email && m.role !== 'OWNER' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`${m.email} wirklich aus dem Haushalt entfernen ? `)) {
                                await removeMemberAction(editingHousehold.id, m.email);
                                refreshMembers(editingHousehold.id);
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

                {/* Danger Zone */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-red-500">Gefahrenzone</label>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">Das Löschen eines Haushalts entfernt alle Zähler, Listen und Notizen unwiderruflich.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (window.confirm(`Möchtest du "${editingHousehold.name}" wirklich löschen ? `)) {
                        try {
                          await deleteHouseholdAction(editingHousehold.id);
                          if (selectedHouseholdId === editingHousehold.id) setSelectedHouseholdId(null);
                          setEditingHousehold(null);
                          refreshHouseholds();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="w-full btn bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-3 text-xs uppercase tracking-widest transition-all font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Haushalt löschen
                  </button>
                </div>
              </div>

              <div className="p-3 border-t border-border bg-accent/10">
                <button
                  onClick={() => setEditingHousehold(null)}
                  className="w-full btn btn-primary py-3"
                >
                  Fertig
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile & Settings Overlay */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-3 border-b border-border">
                <div className="space-y-0.5">
                  <h2 className="text-lg font-black tracking-tight">Profil</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{userProfile?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setProfileError("");
                    setProfileSuccess(false);
                  }}
                  className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-4">
                  {/* Name Section */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Anzeigename</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full bg-accent/20 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-accent/40 transition-colors"
                    />
                  </div>

                  <div className="pt-2 border-t border-border/50 space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Passwort ändern</label>
                    <div className="space-y-2">
                      <input
                        type="password"
                        placeholder="Aktuelles Passwort"
                        value={profileData.currentPassword}
                        onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                        className="w-full bg-accent/20 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-accent/40 transition-colors"
                      />
                      <input
                        type="password"
                        placeholder="Neues Passwort"
                        value={profileData.newPassword}
                        onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                        className="w-full bg-accent/20 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-accent/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {profileError && <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">{profileError}</p>}
                {profileSuccess && <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Erfolgreich gespeichert!</p>}

                <div className="pt-2 border-t border-border">
                  <button
                    onClick={async () => {
                      await logoutAction();
                      setSession(null);
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Abmelden
                  </button>
                </div>
              </div>

              <div className="p-3 border-t border-border bg-accent/10 flex gap-2">
                <button
                  onClick={async () => {
                    setProfileError("");
                    setProfileSuccess(false);
                    try {
                      await updateProfile(profileData);
                      setProfileSuccess(true);
                      setProfileData(prev => ({ ...prev, currentPassword: "", newPassword: "" }));
                      refreshProfile();
                    } catch (err: any) {
                      setProfileError(err.message);
                    }
                  }}
                  className="flex-1 btn btn-primary py-3"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
