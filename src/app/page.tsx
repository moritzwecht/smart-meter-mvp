"use client";

import { useEffect, useState, useTransition, useOptimistic } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, User } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import {
  logout as logoutAction,
  getHouseholds as getHouseholdsAction,
  createHousehold as createHouseholdAction,
  updateHousehold as updateHouseholdAction,
  updateHouseholdDetails,
  deleteHousehold as deleteHouseholdAction,
  removeMember as removeMemberAction,
  getMeters,
  getTodoLists,
  getNotes,
  addNote,
  addMeter,
  addTodoList,
  updateNote,
  deleteNote,
  updateTodoList,
  deleteTodoList,
  addTodoItem,
  toggleTodoItem,
  deleteTodoItem,
  updateMeter,
  deleteMeter,
  addReading,
  deleteReading,
  inviteToHousehold,
  getHouseholdMembers,
  updateProfile,
  getUserProfile,
  toggleMeterPin,
  toggleTodoListPin,
  toggleNotePin,
} from "./actions";

// Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { HouseholdMenu } from "@/components/dashboard/household/HouseholdMenu";
import { MeterWidget } from "@/components/dashboard/meter/MeterWidget";
import { NoteWidget } from "@/components/dashboard/note/NoteWidget";
import { ListWidget } from "@/components/dashboard/list/ListWidget";
import { EfficiencyWidget } from "@/components/dashboard/EfficiencyWidget";
import { EfficiencySettingsDialog } from "@/components/dashboard/EfficiencySettingsDialog";
import { EfficiencyDetailsDialog } from "@/components/dashboard/EfficiencyDetailsDialog";

// Dialog Components
// Dialog Components
import { HouseholdSettingsDialog } from "@/components/dashboard/household/HouseholdSettingsDialog";
import { AddMeterDialog } from "@/components/dashboard/meter/AddMeterDialog";
import { MeterReadingDialog } from "@/components/dashboard/meter/MeterReadingDialog";
import { MeterSettingsDialog } from "@/components/dashboard/meter/MeterSettingsDialog";
import { NoteEditDialog } from "@/components/dashboard/note/NoteEditDialog";
import { ListEditDialog } from "@/components/dashboard/list/ListEditDialog";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

interface Session {
  email: string;
  expires: string;
}

interface Household {
  id: number;
  name: string;
  userId: number;
  sqm?: number;
  persons?: number;
  heatingType?: string;
  waterHeatingType?: string;
  showEfficiency?: string;
  createdAt: string;
}

interface Reading {
  id: number;
  meterId: number;
  value: string;
  date: string | Date;
  createdAt: string | Date;
}

interface Meter {
  id: number;
  name: string;
  type: string;
  householdId: number;
  unit: string;
  isPinned: string;
  createdAt: string | Date;
  readings?: Reading[];
}

interface TodoItem {
  id: number;
  listId: number;
  content: string;
  completed: string;
  createdAt: string | Date;
}

interface TodoList {
  id: number;
  name: string;
  householdId: number;
  isPinned: string;
  createdAt: string | Date;
  items?: TodoItem[];
}

interface Note {
  id: number;
  title: string;
  content: string | null;
  householdId: number;
  isPinned: string;
  createdAt: string | Date;
}

type Widget = (Meter & { widgetType: 'METER' }) | (TodoList & { widgetType: 'LIST' }) | (Note & { widgetType: 'NOTE' }) | { id: string | number; widgetType: 'EFFICIENCY', createdAt: string | Date, householdId: number, isPinned?: string };

interface ProfileData {
  name: string;
  currentPassword?: string;
  newPassword?: string;
}

export default function Dashboard() {
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWidgetsLoading, setIsWidgetsLoading] = useState(false);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdMenuOpen, setIsHouseholdMenuOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [optimisticWidgets, addOptimisticWidget] = useOptimistic(
    widgets,
    (state: Widget[], newWidget: Widget) => [newWidget, ...state]
  );
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingList, setEditingList] = useState<TodoList | null>(null);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [showEfficiencySettings, setShowEfficiencySettings] = useState(false);
  const [showEfficiencyDetails, setShowEfficiencyDetails] = useState(false);
  const [addingReadingForMeter, setAddingReadingForMeter] = useState<Meter | null>(null);
  const [showAddMeterDialog, setShowAddMeterDialog] = useState(false);
  const [newMeterData, setNewMeterData] = useState({ name: "Neuer Zähler", type: "ELECTRICITY", unit: "kWh" });
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [newItemValue, setNewItemValue] = useState("");
  const [userProfile, setUserProfile] = useState<{ email: string; name: string } | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({ name: "", currentPassword: "", newPassword: "" });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const refreshHouseholds = async () => {
    const data = await getHouseholdsAction();
    setHouseholds(data);
    if (data.length > 0 && !selectedHouseholdId) {
      const lastId = localStorage.getItem('lastHouseholdId');
      if (lastId) {
        const id = parseInt(lastId);
        if (data.find(h => h.id === id)) {
          setSelectedHouseholdId(id);
          return;
        }
      }
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

  const handleRenameHousehold = () => {
    if (!editingHousehold || !editingHousehold.name.trim()) return;
    startTransition(async () => {
      try {
        await updateHouseholdAction(editingHousehold.id, editingHousehold.name);
        refreshHouseholds();
      } catch (err: any) {
        alert(err.message);
      }
    });
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

  useEffect(() => {
    if (selectedHouseholdId) {
      localStorage.setItem('lastHouseholdId', selectedHouseholdId.toString());
    }
  }, [selectedHouseholdId]);

  const refreshProfile = async () => {
    const data = await getUserProfile();
    if (data) {
      setUserProfile(data);
      setProfileData((prev: ProfileData) => ({ ...prev, name: data.name }));
    }
  };

  useEffect(() => {
    if (session) {
      refreshProfile();
    }
  }, [session]);

  const refreshWidgets = async (householdId: number) => {
    setIsWidgetsLoading(true);
    try {
      const [m, l, n] = await Promise.all([
        getMeters(householdId),
        getTodoLists(householdId),
        getNotes(householdId)
      ]);

      const allWidgets: Widget[] = [
        ...m.map(i => ({ ...i, widgetType: 'METER' as const })),
        ...l.map(i => ({ ...i, widgetType: 'LIST' as const })),
        ...n.map(i => ({ ...i, widgetType: 'NOTE' as const }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setWidgets(allWidgets);

      // If we're currently editing a list, update its local state too (atomically)
      setEditingList((prev: TodoList | null) => {
        if (!prev) return null;
        const updatedList = l.find((list: any) => list.id === prev.id);
        return (updatedList as TodoList) || prev;
      });

      // If we're currently adding a reading, update its local state too (atomically)
      setAddingReadingForMeter((prev: Meter | null) => {
        if (!prev) return null;
        const updatedMeter = m.find((meter: any) => meter.id === prev.id);
        return (updatedMeter as Meter) || prev;
      });
    } finally {
      setIsWidgetsLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(async data => {
        setSession(data.session);
        if (data.session) {
          await refreshHouseholds();
          // The selectedHouseholdId useEffect will trigger refreshWidgets
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedHouseholdId) {
      refreshWidgets(selectedHouseholdId).then(() => {
        if (loading) setLoading(false);
      });

      const interval = setInterval(() => {
        refreshWidgets(selectedHouseholdId);
      }, 5000);

      return () => clearInterval(interval);
    } else if (session && households.length === 0) {
      // If session exists but no households, we can stop loading (will show 0 results or prompt)
      setLoading(false);
    }
  }, [selectedHouseholdId, session, households.length]);

  const handleCreateHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    startTransition(async () => {
      await createHouseholdAction(newHouseholdName);
      setNewHouseholdName("");
      setIsHouseholdMenuOpen(false);
      refreshHouseholds();
    });
  };

  const handleAddNote = () => {
    startTransition(async () => {
      addOptimisticWidget({
        id: Math.random(),
        widgetType: "NOTE",
        title: "Neue Notiz",
        content: "",
        isPinned: "false",
        createdAt: new Date(),
        householdId: selectedHouseholdId!,
      });
      await addNote(selectedHouseholdId!, "Neue Notiz");
      refreshWidgets(selectedHouseholdId!);
    });
  };

  const handleAddMeter = () => {
    setNewMeterData({
      name: "Neuer Zähler",
      type: "ELECTRICITY",
      unit: "kWh",
    });
    setShowAddMeterDialog(true);
  };

  const handleAddList = () => {
    startTransition(async () => {
      addOptimisticWidget({
        id: Math.random(),
        widgetType: "LIST",
        name: "Neue Liste",
        items: [],
        isPinned: "false",
        createdAt: new Date(),
        householdId: selectedHouseholdId!,
      });
      await addTodoList(selectedHouseholdId!, "Neue Liste");
      refreshWidgets(selectedHouseholdId!);
    });
  };

  if (loading) return <DashboardSkeleton />;

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
            <p className="text-sm text-muted-foreground font-mono">v1.4.2</p>
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
    <main className="min-h-screen p-4 md:p-8 pt-17 md:pt-17 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      <DashboardHeader
        selectedHouseholdName={selectedHousehold ? selectedHousehold.name : "Wähle Haushalt"}
        isHouseholdMenuOpen={isHouseholdMenuOpen}
        setIsHouseholdMenuOpen={setIsHouseholdMenuOpen}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        userName={userProfile?.name}
        onOpenProfile={() => setActiveTab("profile")}
      >
        <HouseholdMenu
          isOpen={isHouseholdMenuOpen}
          households={households}
          selectedHouseholdId={selectedHouseholdId}
          onSelectHousehold={(id) => {
            if (id !== selectedHouseholdId) {
              setWidgets([]); // Clear widgets to show skeleton
            }
            setSelectedHouseholdId(id);
            setIsHouseholdMenuOpen(false);
          }}
          onEditHousehold={(h) => {
            setEditingHousehold(h);
            setIsHouseholdMenuOpen(false);
            refreshMembers(h.id);
          }}
          newHouseholdName={newHouseholdName}
          setNewHouseholdName={setNewHouseholdName}
          onCreateHousehold={handleCreateHousehold}
        />
      </DashboardHeader>

      {selectedHousehold ? (
        <div className="space-y-3">
          {(isWidgetsLoading && widgets.length === 0) ? (
            <div className="pt-4">
              <DashboardSkeleton hideHeader />
            </div>
          ) : (
            <>

              {activeTab === "dashboard" && (
                <div className="space-y-12 pb-24">
                  {optimisticWidgets.filter(w => w.isPinned === 'true').length > 0 || selectedHousehold?.showEfficiency === "true" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedHousehold?.showEfficiency === "true" && (
                        <EfficiencyWidget
                          key="efficiency-barometer"
                          household={selectedHousehold}
                          meters={widgets.filter(m => m.widgetType === 'METER')}
                          onOpenSettings={() => setShowEfficiencySettings(true)}
                          onOpenDetails={() => setShowEfficiencyDetails(true)}
                        />
                      )}
                      {optimisticWidgets
                        .filter((w) => w.isPinned === "true")
                        .map((w) => (
                          <div key={w.id}>
                            {w.widgetType === "METER" && (
                              <MeterWidget
                                meter={w}
                                onAddReading={() => setAddingReadingForMeter(w)}
                                onEditMeter={() => setEditingMeter(w)}
                                onPin={() => {
                                  startTransition(async () => {
                                    await toggleMeterPin(w.id, "false");
                                    refreshWidgets(selectedHouseholdId!);
                                  });
                                }}
                              />
                            )}
                            {w.widgetType === "NOTE" && (
                              <NoteWidget
                                note={w}
                                onEdit={() => setEditingNote(w)}
                                onDelete={() => {
                                  if (window.confirm("Wirklich löschen?")) {
                                    startTransition(async () => {
                                      await deleteNote(w.id);
                                      refreshWidgets(selectedHouseholdId!);
                                    });
                                  }
                                }}
                                onPin={() => {
                                  startTransition(async () => {
                                    await toggleNotePin(w.id, "false");
                                    refreshWidgets(selectedHouseholdId!);
                                  });
                                }}
                              />
                            )}
                            {w.widgetType === "LIST" && (
                              <ListWidget
                                list={w}
                                onEdit={() => setEditingList(w)}
                                onDelete={() => {
                                  if (window.confirm("Wirklich löschen?")) {
                                    startTransition(async () => {
                                      await deleteTodoList(w.id);
                                      refreshWidgets(selectedHouseholdId!);
                                    });
                                  }
                                }}
                                onToggleItem={(id, status) => {
                                  startTransition(async () => {
                                    await toggleTodoItem(id, status);
                                    refreshWidgets(selectedHouseholdId!);
                                  });
                                }}
                                onPin={() => {
                                  startTransition(async () => {
                                    await toggleTodoListPin(w.id, "false");
                                    refreshWidgets(selectedHouseholdId!);
                                  });
                                }}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="py-24 text-center border-2 border-dashed border-foreground/5 rounded-3xl">
                      <p className="text-sm text-muted-foreground">Pinne Elemente aus den anderen Sektionen, um sie hier zu sehen.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "lists" && (
                <div className="space-y-4 pb-24">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {optimisticWidgets
                      .filter((w) => w.widgetType === "LIST")
                      .map((w) => (
                        <ListWidget
                          key={w.id}
                          list={w as TodoList}
                          onEdit={() => setEditingList(w as TodoList)}
                          onDelete={() => {
                            if (window.confirm("Wirklich löschen?")) {
                              startTransition(async () => {
                                await deleteTodoList(w.id);
                                refreshWidgets(selectedHouseholdId!);
                              });
                            }
                          }}
                          onToggleItem={(id, status) => {
                            startTransition(async () => {
                              await toggleTodoItem(id, status);
                              refreshWidgets(selectedHouseholdId!);
                            });
                          }}
                          onPin={() => {
                            startTransition(async () => {
                              await toggleTodoListPin(w.id, (w as TodoList).isPinned === "true" ? "false" : "true");
                              refreshWidgets(selectedHouseholdId!);
                            });
                          }}
                        />
                      ))}
                    <button
                      onClick={handleAddList}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[160px]"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Liste hinzufügen
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-4 pb-24">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {optimisticWidgets
                      .filter((w) => w.widgetType === "NOTE")
                      .map((w) => (
                        <NoteWidget
                          key={w.id}
                          note={w as Note}
                          onEdit={() => setEditingNote(w as Note)}
                          onDelete={() => {
                            if (window.confirm("Wirklich löschen?")) {
                              startTransition(async () => {
                                await deleteNote(w.id);
                                refreshWidgets(selectedHouseholdId!);
                              });
                            }
                          }}
                          onPin={() => {
                            startTransition(async () => {
                              await toggleNotePin(w.id, (w as Note).isPinned === "true" ? "false" : "true");
                              refreshWidgets(selectedHouseholdId!);
                            });
                          }}
                        />
                      ))}
                    <button
                      onClick={handleAddNote}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[160px]"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Notiz hinzufügen
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "meters" && (
                <div className="space-y-4 pb-24">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {optimisticWidgets
                      .filter((w) => w.widgetType === "METER")
                      .map((w) => (
                        <MeterWidget
                          key={w.id}
                          meter={w as Meter}
                          onAddReading={() => setAddingReadingForMeter(w as Meter)}
                          onEditMeter={() => setEditingMeter(w as Meter)}
                          onPin={() => {
                            startTransition(async () => {
                              await toggleMeterPin(w.id, (w as Meter).isPinned === "true" ? "false" : "true");
                              refreshWidgets(selectedHouseholdId!);
                            });
                          }}
                        />
                      ))}
                    <button
                      onClick={handleAddMeter}
                      className="flex flex-col items-center justify-center gap-3 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                        Zähler hinzufügen
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "profile" && (
                <div className="space-y-8 pb-24 max-w-lg mx-auto">
                  <div className="bg-card border border-border rounded-3xl p-6 space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-8 h-8 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xl font-bold truncate">{userProfile?.name}</h4>
                        <p className="text-sm text-muted-foreground truncate">{userProfile?.email}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                          Anzeigename
                        </label>
                        <input
                          type="text"
                          value={profileData.name}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          className="w-full input-field"
                        />
                      </div>

                      <div className="pt-6 border-t border-border/50 space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                          Passwort ändern
                        </label>
                        <div className="space-y-3">
                          <input
                            type="password"
                            placeholder="Aktuelles Passwort"
                            value={profileData.currentPassword}
                            onChange={(e) =>
                              setProfileData({ ...profileData, currentPassword: e.target.value })
                            }
                            className="w-full input-field"
                          />
                          <input
                            type="password"
                            placeholder="Neues Passwort"
                            value={profileData.newPassword}
                            onChange={(e) =>
                              setProfileData({ ...profileData, newPassword: e.target.value })
                            }
                            className="w-full input-field"
                          />
                        </div>
                      </div>

                      {profileError && (
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">
                          {profileError}
                        </p>
                      )}
                      {profileSuccess && (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
                          Erfolgreich gespeichert!
                        </p>
                      )}

                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => {
                            setProfileError("");
                            setProfileSuccess(false);
                            startTransition(async () => {
                              try {
                                await updateProfile(profileData);
                                setProfileSuccess(true);
                                setProfileData((prev: ProfileData) => ({
                                  ...prev,
                                  currentPassword: "",
                                  newPassword: "",
                                }));
                                refreshProfile();
                              } catch (err: any) {
                                setProfileError(err.message);
                              }
                            });
                          }}
                          disabled={isPending}
                          className="btn btn-primary w-full py-4 text-sm font-black uppercase tracking-widest disabled:opacity-70"
                        >
                          Speichern
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm("Abmelden?")) {
                              startTransition(async () => {
                                await logoutAction();
                                setSession(null);
                              });
                            }
                          }}
                          className="btn btn-danger w-full py-4 text-sm font-black uppercase tracking-widest"
                        >
                          Abmelden
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="py-24 text-center border-2 border-dashed border-black/20">
          <p className="font-bold uppercase tracking-widest opacity-30">Wähle oder erstelle einen Haushalt</p>
        </div>
      )}

      <AddMeterDialog
        isOpen={showAddMeterDialog}
        onClose={() => setShowAddMeterDialog(false)}
        newMeterData={newMeterData}
        setNewMeterData={setNewMeterData}
        isPending={isPending}
        onAdd={() => {
          startTransition(async () => {
            await addMeter(
              selectedHouseholdId!,
              newMeterData.type,
              newMeterData.unit
            );
            setShowAddMeterDialog(false);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
      />

      <MeterReadingDialog
        isOpen={!!addingReadingForMeter}
        onClose={() => setAddingReadingForMeter(null)}
        meter={addingReadingForMeter!}
        value={newItemValue}
        setValue={setNewItemValue}
        isPending={isPending}
        onSave={(e) => {
          e.preventDefault();
          if (!newItemValue.trim() || !addingReadingForMeter) return;
          startTransition(async () => {
            await addReading(addingReadingForMeter.id, newItemValue, new Date());
            setNewItemValue("");
            setAddingReadingForMeter(null);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onOpenSettings={() => {
          if (addingReadingForMeter) {
            const meter = addingReadingForMeter;
            setAddingReadingForMeter(null);
            setEditingMeter(meter);
          }
        }}
      />

      <NoteEditDialog
        isOpen={!!editingNote}
        note={editingNote!}
        setNote={setEditingNote}
        onClose={() => setEditingNote(null)}
        isPending={isPending}
        onSave={() => {
          if (!editingNote) return;
          startTransition(async () => {
            await updateNote(
              editingNote.id,
              editingNote.title,
              editingNote.content || undefined
            );
            setEditingNote(null);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
      />

      <ListEditDialog
        isOpen={!!editingList}
        list={editingList!}
        setList={setEditingList}
        onClose={() => setEditingList(null)}
        isPending={isPending}
        onUpdateList={(id, name) => {
          startTransition(async () => {
            await updateTodoList(id, name);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onAddItem={(content) => {
          if (!editingList) return;
          startTransition(async () => {
            await addTodoItem(editingList.id, content);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onToggleItem={(id, status) => {
          startTransition(async () => {
            await toggleTodoItem(id, status);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onDeleteItem={(id) => {
          startTransition(async () => {
            await deleteTodoItem(id);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        newItemValue={newItemValue}
        setNewItemValue={setNewItemValue}
      />

      <MeterSettingsDialog
        isOpen={!!editingMeter}
        onClose={() => setEditingMeter(null)}
        meter={editingMeter!}
        isPending={isPending}
        onUpdateMeter={(id, type, unit) => {
          startTransition(async () => {
            await updateMeter(id, type, unit);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onDeleteReading={(id) => {
          if (window.confirm("Ablesung löschen?")) {
            startTransition(async () => {
              await deleteReading(id);
              refreshWidgets(selectedHouseholdId!);
            });
          }
        }}
        onDeleteMeter={(id) => {
          if (window.confirm("Möchtest du diesen Zähler wirklich löschen? Alle zugehörigen Ablesungen werden ebenfalls gelöscht.")) {
            startTransition(async () => {
              await deleteMeter(id);
              setEditingMeter(null);
              refreshWidgets(selectedHouseholdId!);
            });
          }
        }}
      />

      <HouseholdSettingsDialog
        isOpen={!!editingHousehold}
        onClose={() => setEditingHousehold(null)}
        household={editingHousehold!}
        setHousehold={setEditingHousehold}
        onRename={handleRenameHousehold}
        isPending={isPending}
        onDelete={() => {
          if (
            !editingHousehold ||
            !window.confirm(
              `Möchtest du "${editingHousehold.name}" wirklich löschen?`
            )
          ) {
            return;
          }
          startTransition(async () => {
            try {
              await deleteHouseholdAction(editingHousehold.id);
              if (selectedHouseholdId === editingHousehold.id)
                setSelectedHouseholdId(null);
              setEditingHousehold(null);
              refreshHouseholds();
            } catch (err: any) {
              alert(err.message);
            }
          });
        }}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        onInvite={(e) => {
          e.preventDefault();
          if (!editingHousehold) return;
          setInviteError("");
          startTransition(async () => {
            try {
              await inviteToHousehold(editingHousehold.id, inviteEmail);
              setInviteEmail("");
              refreshMembers(editingHousehold.id);
            } catch (err: any) {
              setInviteError(err.message || "Fehler beim Einladen.");
            }
          });
        }}
        inviteError={inviteError}
        members={members}
        onRemoveMember={(email) => {
          if (!editingHousehold) return;
          if (window.confirm(`${email} wirklich aus dem Haushalt entfernen?`)) {
            startTransition(async () => {
              await removeMemberAction(editingHousehold.id, email);
              refreshMembers(editingHousehold.id);
            });
          }
        }}
        currentUserEmail={session?.email}
      />


      <EfficiencySettingsDialog
        isOpen={showEfficiencySettings}
        onClose={() => setShowEfficiencySettings(false)}
        household={selectedHousehold!}
        meters={widgets.filter(w => w.widgetType === 'METER')}
        onUpdateHousehold={async (data) => {
          await updateHouseholdDetails(selectedHouseholdId!, data);
          await refreshHouseholds();
          await refreshWidgets(selectedHouseholdId!);
        }}
        onUpdateMeter={async (id, type, unit, target, yearly, price, payment) => {
          await updateMeter(id, type, unit, target, yearly, price, payment);
        }}
        isPending={isPending}
      />

      <EfficiencyDetailsDialog
        isOpen={showEfficiencyDetails}
        onClose={() => setShowEfficiencyDetails(false)}
        meters={widgets.filter(w => w.widgetType === 'METER')}
      />

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
