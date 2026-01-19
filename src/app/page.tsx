"use client";

import { useEffect, useState, useTransition, useOptimistic, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, User } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import * as actions from "./actions";
import { DataService } from "@/lib/offline/data-service";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";

// Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { HouseholdMenu } from "@/components/dashboard/household/HouseholdMenu";
import { MeterWidget } from "@/components/dashboard/meter/MeterWidget";
import { NoteWidget } from "@/components/dashboard/note/NoteWidget";
import { ListWidget } from "@/components/dashboard/list/ListWidget";


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

type Widget =
  | (Meter & { widgetType: "METER" })
  | (TodoList & { widgetType: "LIST" })
  | (Note & { widgetType: "NOTE" });

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
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(
    null,
  );
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdMenuOpen, setIsHouseholdMenuOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const localWidgets = useLiveQuery(async () => {
    if (!selectedHouseholdId) return [];

    // Fetch all entities for household
    const [m, l, n] = await Promise.all([
      db.meters.where("householdId").equals(selectedHouseholdId).toArray(),
      db.todoLists.where("householdId").equals(selectedHouseholdId).toArray(),
      db.notes.where("householdId").equals(selectedHouseholdId).toArray(),
    ]);

    // Batch fetch readings and items - Fix N+1 query problem
    const meterIds = m.map(meter => meter.id);
    const listIds = l.map(list => list.id);

    const [allReadings, allItems] = await Promise.all([
      meterIds.length > 0
        ? db.readings.where('meterId').anyOf(meterIds).toArray()
        : Promise.resolve([]),
      listIds.length > 0
        ? db.todoItems.where('listId').anyOf(listIds).toArray()
        : Promise.resolve([]),
    ]);

    // Group readings by meterId in memory
    const readingsByMeter: Record<number, Array<(typeof allReadings)[number]>> = {};
    for (const reading of allReadings) {
      if (!readingsByMeter[reading.meterId]) {
        readingsByMeter[reading.meterId] = [];
      }
      readingsByMeter[reading.meterId].push(reading);
    }

    // Sort readings by date for each meter
    for (const meterId in readingsByMeter) {
      readingsByMeter[meterId].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    }

    // Group items by listId in memory
    const itemsByList: Record<number, Array<(typeof allItems)[number]>> = {};
    for (const item of allItems) {
      if (!itemsByList[item.listId]) {
        itemsByList[item.listId] = [];
      }
      itemsByList[item.listId].push(item);
    }

    // Sort items by createdAt for each list
    for (const listId in itemsByList) {
      itemsByList[listId].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    // Attach readings and items to their parent entities
    const metersWithReadings = m.map(meter => ({
      ...meter,
      readings: readingsByMeter[meter.id] || []
    }));

    const listsWithItems = l.map(list => ({
      ...list,
      items: itemsByList[list.id] || []
    }));

    return [
      ...metersWithReadings.map((i) => ({ ...i, widgetType: "METER" as const })),
      ...listsWithItems.map((i) => ({ ...i, widgetType: "LIST" as const })),
      ...n.map((i) => ({ ...i, widgetType: "NOTE" as const })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [selectedHouseholdId]);

  const [optimisticWidgets, addOptimisticWidget] = useOptimistic(
    localWidgets || [],
    (state: Widget[], newWidget: Widget) => [newWidget, ...state],
  );
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingMeterId, setEditingMeterId] = useState<number | null>(null);
  const [addingReadingForMeterId, setAddingReadingForMeterId] =
    useState<number | null>(null);
  const [showAddMeterDialog, setShowAddMeterDialog] = useState(false);
  const [newMeterData, setNewMeterData] = useState({
    name: "Neuer Zähler",
    type: "ELECTRICITY",
    unit: "kWh",
  });
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(
    null,
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [newItemValue, setNewItemValue] = useState("");
  const [userProfile, setUserProfile] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    currentPassword: "",
    newPassword: "",
  });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const editingNote = optimisticWidgets.find(w => w.id === editingNoteId && w.widgetType === "NOTE") as Note | undefined;
  const editingList = optimisticWidgets.find(w => w.id === editingListId && w.widgetType === "LIST") as TodoList | undefined;
  const editingMeter = optimisticWidgets.find(w => w.id === editingMeterId && w.widgetType === "METER") as Meter | undefined;
  const addingReadingForMeter = optimisticWidgets.find(w => w.id === addingReadingForMeterId && w.widgetType === "METER") as Meter | undefined;

  const refreshHouseholds = useCallback(async () => {
    const data = await DataService.getHouseholds();
    setHouseholds(data);
    if (data.length > 0 && !selectedHouseholdId) {
      const lastId = localStorage.getItem("lastHouseholdId");
      if (lastId) {
        const id = parseInt(lastId);
        if (data.find((h) => h.id === id)) {
          setSelectedHouseholdId(id);
          return;
        }
      }
      setSelectedHouseholdId(data[0].id);
    }
  }, [selectedHouseholdId]);

  const refreshMembers = useCallback(async (hId: number) => {
    try {
      const data = await actions.getHouseholdMembers(hId);
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  }, []);

  const handleRenameHousehold = useCallback(() => {
    if (!editingHousehold || !editingHousehold.name.trim()) return;
    startTransition(async () => {
      try {
        await actions.updateHousehold(
          editingHousehold.id,
          editingHousehold.name,
        );
        refreshHouseholds();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }, [editingHousehold, refreshHouseholds]);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    // Apply theme to document element
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (selectedHouseholdId) {
      localStorage.setItem("lastHouseholdId", selectedHouseholdId.toString());
    }
  }, [selectedHouseholdId]);

  const refreshProfile = useCallback(async () => {
    const data = await actions.getUserProfile();
    if (data) {
      setUserProfile(data);
      setProfileData((prev: ProfileData) => ({ ...prev, name: data.name }));
    }
  }, []);

  useEffect(() => {
    if (session) {
      refreshProfile();
    }
  }, [session]);

  const refreshWidgets = useCallback(async (householdId: number) => {
    // Only show loading if we don't have local widgets yet
    const hasLocal = (await db.meters.where('householdId').equals(householdId).count()) > 0;
    if (!hasLocal) setIsWidgetsLoading(true);

    try {
      await DataService.getWidgets(householdId, {
        notes: editingNoteId ? [editingNoteId] : [],
        lists: editingListId ? [editingListId] : [],
        meters: editingMeterId ? [editingMeterId] : []
      });
    } finally {
      setIsWidgetsLoading(false);
    }
  }, [editingNoteId, editingListId, editingMeterId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(async (data) => {
        setSession(data.session);
        if (data.session) {
          await refreshHouseholds();
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
      setLoading(false);
    }
  }, [selectedHouseholdId, session, households.length, editingNoteId, editingListId, editingMeterId]);
  const handleCreateHousehold = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    startTransition(async () => {
      await actions.createHousehold(newHouseholdName);
      setNewHouseholdName("");
      setIsHouseholdMenuOpen(false);
      refreshHouseholds();
    });
  }, [newHouseholdName, refreshHouseholds]);

  const handleAddNote = useCallback(() => {
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
      await DataService.addNote(selectedHouseholdId!, "Neue Notiz");
    });
  }, [selectedHouseholdId, addOptimisticWidget]);

  const handleAddMeter = useCallback(() => {
    setNewMeterData({
      name: "Neuer Zähler",
      type: "ELECTRICITY",
      unit: "kWh",
    });
    setShowAddMeterDialog(true);
  }, []);

  const handleAddList = useCallback(() => {
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
      await DataService.addTodoList(selectedHouseholdId!, "Neue Liste");
    });
  }, [selectedHouseholdId, addOptimisticWidget]);

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
            <h1 className="text-4xl font-black tracking-tighter text-foreground">
              HOME
            </h1>
            <p className="text-sm text-muted-foreground font-mono">v1.4.2</p>
          </div>
          <div className="bg-card text-card-foreground rounded-lg border border-border p-3 shadow-xl shadow-foreground/5">
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  const selectedHousehold = households.find(
    (h) => h.id === selectedHouseholdId,
  );

  return (
    <main className="min-h-[100dvh] p-4 md:p-8 pt-[calc(5rem+env(safe-area-inset-top))] md:pt-24 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      <DashboardHeader
        selectedHouseholdName={
          selectedHousehold ? selectedHousehold.name : "Wähle Haushalt"
        }
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
          {isWidgetsLoading && optimisticWidgets.length === 0 ? (
            <div className="pt-4">
              <DashboardSkeleton hideHeader />
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <div className="space-y-12 pb-24">
                  {optimisticWidgets.filter((w) => w.isPinned === "true")
                    .length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {optimisticWidgets
                        .filter((w) => w.isPinned === "true")
                        .map((w) => (
                          <div key={w.id}>
                            {w.widgetType === "METER" && (
                              <MeterWidget
                                meter={w}
                                onAddReading={() => setAddingReadingForMeterId(w.id)}
                                onEditMeter={() => setEditingMeterId(w.id)}
                                onPin={() => {
                                  startTransition(async () => {
                                    await DataService.toggleMeterPin(
                                      w.id,
                                      "false",
                                    );
                                  });
                                }}
                              />
                            )}
                            {w.widgetType === "NOTE" && (
                              <NoteWidget
                                note={w}
                                onEdit={() => setEditingNoteId(w.id)}
                                onPin={() => {
                                  startTransition(async () => {
                                    await DataService.toggleNotePin(
                                      w.id,
                                      "false",
                                    );
                                  });
                                }}
                              />
                            )}
                            {w.widgetType === "LIST" && (
                              <ListWidget
                                list={w as TodoList}
                                onEdit={() => setEditingListId(w.id)}
                                onPin={() => {
                                  startTransition(async () => {
                                    await DataService.toggleTodoListPin(
                                      w.id,
                                      "false",
                                    );
                                  });
                                }}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="py-24 text-center border-2 border-dashed border-foreground/5 rounded-3xl">
                      <p className="text-sm text-muted-foreground">
                        Pinne Elemente aus den anderen Sektionen, um sie hier zu
                        sehen.
                      </p>
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
                          onEdit={() => setEditingListId(w.id)}
                          onPin={() => {
                            startTransition(async () => {
                              await DataService.toggleTodoListPin(
                                w.id,
                                (w as TodoList).isPinned === "true"
                                  ? "false"
                                  : "true",
                              );
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
                          onEdit={() => setEditingNoteId(w.id)}
                          onPin={() => {
                            startTransition(async () => {
                              await DataService.toggleNotePin(
                                w.id,
                                (w as Note).isPinned === "true"
                                  ? "false"
                                  : "true",
                              );
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
                          onAddReading={() => setAddingReadingForMeterId(w.id)}
                          onEditMeter={() => setEditingMeterId(w.id)}
                          onPin={() => {
                            startTransition(async () => {
                              await DataService.toggleMeterPin(
                                w.id,
                                (w as Meter).isPinned === "true"
                                  ? "false"
                                  : "true",
                              );
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
                        <h4 className="text-xl font-bold truncate">
                          {userProfile?.name}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {userProfile?.email}
                        </p>
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
                          onChange={(e) =>
                            setProfileData({
                              ...profileData,
                              name: e.target.value,
                            })
                          }
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
                              setProfileData({
                                ...profileData,
                                currentPassword: e.target.value,
                              })
                            }
                            className="w-full input-field"
                          />
                          <input
                            type="password"
                            placeholder="Neues Passwort"
                            value={profileData.newPassword}
                            onChange={(e) =>
                              setProfileData({
                                ...profileData,
                                newPassword: e.target.value,
                              })
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
                                await actions.updateProfile(profileData);
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
                                await actions.logout();
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
        <div className="py-24 text-center border-2 border-dashed border-foreground/5 rounded-3xl">
          <p className="text-sm text-muted-foreground">
            Wähle oder erstelle einen Haushalt
          </p>
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
            await DataService.addMeter(
              selectedHouseholdId!,
              newMeterData.type,
              newMeterData.unit,
              // @ts-ignore
              newMeterData.monthlyPayment,
              // @ts-ignore
              newMeterData.basicFee,
              // @ts-ignore
              newMeterData.pricePerUnit,
              // @ts-ignore
              newMeterData.zNumber,
              // @ts-ignore
              newMeterData.calorificValue,
              // @ts-ignore
              newMeterData.priceUnit
            );
            setShowAddMeterDialog(false);
          });
        }}
      />

      <MeterReadingDialog
        isOpen={!!addingReadingForMeter}
        onClose={() => setAddingReadingForMeterId(null)}
        meter={addingReadingForMeter!}
        value={newItemValue}
        setValue={setNewItemValue}
        isPending={isPending}
        onSave={(e) => {
          e.preventDefault();
          if (!newItemValue.trim() || !addingReadingForMeter) return;
          startTransition(async () => {
            await DataService.addReading(
              addingReadingForMeter.id,
              newItemValue,
              new Date(),
            );
            setNewItemValue("");
            setAddingReadingForMeterId(null);
          });
        }}
        onOpenSettings={() => {
          if (addingReadingForMeter) {
            const meterId = addingReadingForMeter.id;
            setAddingReadingForMeterId(null);
            setEditingMeterId(meterId);
          }
        }}
      />

      <NoteEditDialog
        isOpen={!!editingNote}
        note={editingNote!}
        setNote={(note) => {
          db.notes.update(note.id, {
            title: note.title,
            content: note.content,
          });
        }}
        onClose={() => setEditingNoteId(null)}
        isPending={isPending}
        onSave={(title, content) => {
          if (!editingNoteId) return;
          DataService.updateNote(
            editingNoteId,
            title,
            content || undefined,
          );
        }}
        onDelete={(id) => {
          DataService.deleteNote(id);
        }}
      />

      <ListEditDialog
        isOpen={!!editingList}
        list={editingList!}
        setList={(list) => {
          db.todoLists.update(list.id, { name: list.name });
        }}
        onClose={() => setEditingListId(null)}
        isPending={isPending}
        onUpdateList={async (id, name) => {
          await DataService.updateTodoList(id, name);
        }}
        onAddItem={async (content) => {
          if (!editingListId) return;
          await DataService.addTodoItem(editingListId, content);
        }}
        onToggleItem={async (id, status) => {
          await DataService.toggleTodoItem(id, status);
        }}
        onDeleteItem={async (id) => {
          await DataService.deleteTodoItem(id);
        }}
        onDeleteList={(id) => {
          DataService.deleteTodoList(id);
          setEditingListId(null);
        }}
        newItemValue={newItemValue}
        setNewItemValue={setNewItemValue}
      />

      <MeterSettingsDialog
        isOpen={!!editingMeter}
        onClose={() => setEditingMeterId(null)}
        meter={editingMeter!}
        isPending={isPending}
        onUpdateMeter={(id, type, unit, monthlyPayment, basicFee, pricePerUnit, zNumber, calorificValue, priceUnit) => {
          DataService.updateMeter(id, type, unit, monthlyPayment, basicFee, pricePerUnit, zNumber, calorificValue, priceUnit);
        }}
        onDeleteReading={(id) => {
          if (window.confirm("Ablesung löschen?")) {
            DataService.deleteReading(id);
          }
        }}
        onDeleteMeter={(id) => {
          if (
            window.confirm(
              "Möchtest du diesen Zähler wirklich löschen? Alle zugehörigen Ablesungen werden ebenfalls gelöscht.",
            )
          ) {
            DataService.deleteMeter(id);
            setEditingMeterId(null);
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
              `Möchtest du "${editingHousehold.name}" wirklich löschen?`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            try {
              await actions.deleteHousehold(editingHousehold.id);
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
              await actions.inviteToHousehold(editingHousehold.id, inviteEmail);
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
              await actions.removeMember(editingHousehold.id, email);
              refreshMembers(editingHousehold.id);
            });
          }
        }}
        currentUserEmail={session?.email}
      />

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
