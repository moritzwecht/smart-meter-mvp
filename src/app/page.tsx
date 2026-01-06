"use client";

import { useEffect, useState, useTransition, useOptimistic } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import {
  logout as logoutAction,
  getHouseholds as getHouseholdsAction,
  createHousehold as createHouseholdAction,
  updateHousehold as updateHouseholdAction,
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
} from "./actions";

// Dashboard Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { HouseholdMenu } from "@/components/dashboard/HouseholdMenu";
import { AddWidgetMenu } from "@/components/dashboard/AddWidgetMenu";
import { MeterWidget } from "@/components/dashboard/MeterWidget";
import { NoteWidget } from "@/components/dashboard/NoteWidget";
import { ListWidget } from "@/components/dashboard/ListWidget";

// Dialog Components
import { ProfileDialog } from "@/components/dashboard/ProfileDialog";
import { HouseholdSettingsDialog } from "@/components/dashboard/HouseholdSettingsDialog";
import { AddMeterDialog } from "@/components/dashboard/AddMeterDialog";
import { MeterReadingDialog } from "@/components/dashboard/MeterReadingDialog";
import { MeterSettingsDialog } from "@/components/dashboard/MeterSettingsDialog";
import { NoteEditDialog } from "@/components/dashboard/NoteEditDialog";
import { ListEditDialog } from "@/components/dashboard/ListEditDialog";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

interface Session {
  email: string;
  expires: string;
}

export default function Dashboard() {
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWidgetsLoading, setIsWidgetsLoading] = useState(false);
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [isHouseholdMenuOpen, setIsHouseholdMenuOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [widgets, setWidgets] = useState<any[]>([]);
  const [optimisticWidgets, addOptimisticWidget] = useOptimistic(
    widgets,
    (state, newWidget: any) => [newWidget, ...state]
  );
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
    setIsWidgetsLoading(true);
    try {
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

      // If we're currently editing a list, update its local state too (atomically)
      setEditingList(prev => {
        if (!prev) return null;
        const updatedList = l.find(list => list.id === prev.id);
        return updatedList || prev;
      });

      // If we're currently adding a reading, update its local state too (atomically)
      setAddingReadingForMeter(prev => {
        if (!prev) return null;
        const updatedMeter = m.find(meter => meter.id === prev.id);
        return updatedMeter || prev;
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
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      <DashboardHeader
        selectedHouseholdName={selectedHousehold ? selectedHousehold.name : "Wähle Haushalt"}
        isHouseholdMenuOpen={isHouseholdMenuOpen}
        setIsHouseholdMenuOpen={setIsHouseholdMenuOpen}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        userName={userProfile?.name}
        onOpenProfile={() => setIsProfileOpen(true)}
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
              <div className="flex justify-between items-center px-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] opacity-30"></h2>
                <button
                  onClick={() => setShowAddWidget(!showAddWidget)}
                  className="btn btn-primary flex items-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Plus
                    className={`w-4 h-4 transition-transform ${showAddWidget ? "rotate-45" : ""
                      } `}
                  />
                </button>
              </div>

              <AddWidgetMenu
                isOpen={showAddWidget}
                isPending={isPending}
                onAddWidget={(type) => {
                  startTransition(async () => {
                    if (type === "NOTE") {
                      addOptimisticWidget({
                        id: Math.random(),
                        widgetType: "NOTE",
                        title: "Neue Notiz",
                        content: "",
                        createdAt: new Date().toISOString(),
                      });
                      await addNote(selectedHouseholdId!, "Neue Notiz");
                    }
                    if (type === "METER") {
                      setNewMeterData({
                        name: "Neuer Zähler",
                        type: "ELECTRICITY",
                        unit: "kWh",
                      });
                      setShowAddMeterDialog(true);
                    }
                    if (type === "LIST") {
                      addOptimisticWidget({
                        id: Math.random(),
                        widgetType: "LIST",
                        name: "Neue Liste",
                        items: [],
                        createdAt: new Date().toISOString(),
                      });
                      await addTodoList(selectedHouseholdId!, "Neue Liste");
                    }
                    setShowAddWidget(false);
                    refreshWidgets(selectedHouseholdId!);
                  });
                }}
              />

              {widgets.length > 0 ? (
                <div className="space-y-12">
                  {/* Meters Section */}
                  {optimisticWidgets.some((w) => w.widgetType === "METER") && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <AnimatePresence mode="popLayout">
                          {optimisticWidgets
                            .filter((w) => w.widgetType === "METER")
                            .map((w) => (
                              <MeterWidget
                                key={w.id}
                                meter={w}
                                onAddReading={() => setAddingReadingForMeter(w)}
                                onEditMeter={() => setEditingMeter(w)}
                              />
                            ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* Other Widgets Section */}
                  {optimisticWidgets.some((w) => w.widgetType !== "METER") && (
                    <div className="space-y-4">
                      <div className="px-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">
                          Listen & Notizen
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                          {optimisticWidgets
                            .filter((w) => w.widgetType !== "METER")
                            .map((w) => (
                              <div key={w.id}>
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
                                  />
                                )}
                              </div>
                            ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !showAddWidget && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-24 flex flex-col items-center justify-center text-center gap-6"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-accent flex items-center justify-center">
                      <Plus className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        Keine Widgets vorhanden
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Erstelle dein erstes Widget, um loszulegen.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddWidget(true)}
                      className="btn btn-primary text-xs uppercase tracking-widest"
                    >
                      Widget erstellen
                    </button>
                  </motion.div>
                )
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
              newMeterData.name,
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
        meter={addingReadingForMeter}
        value={newItemValue}
        setValue={setNewItemValue}
        isPending={isPending}
        onSave={(e) => {
          e.preventDefault();
          if (!newItemValue.trim()) return;
          startTransition(async () => {
            await addReading(addingReadingForMeter.id, newItemValue, new Date());
            setNewItemValue("");
            setAddingReadingForMeter(null);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
        onOpenSettings={() => {
          const meter = addingReadingForMeter;
          setAddingReadingForMeter(null);
          setEditingMeter(meter);
        }}
      />

      <NoteEditDialog
        isOpen={!!editingNote}
        note={editingNote}
        setNote={setEditingNote}
        onClose={() => setEditingNote(null)}
        isPending={isPending}
        onSave={() => {
          startTransition(async () => {
            await updateNote(
              editingNote.id,
              editingNote.title,
              editingNote.content
            );
            setEditingNote(null);
            refreshWidgets(selectedHouseholdId!);
          });
        }}
      />

      <ListEditDialog
        isOpen={!!editingList}
        list={editingList}
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
        meter={editingMeter}
        isPending={isPending}
        onUpdateMeter={(id, name, type, unit) => {
          startTransition(async () => {
            await updateMeter(id, name, type, unit);
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
      />

      <HouseholdSettingsDialog
        isOpen={!!editingHousehold}
        onClose={() => setEditingHousehold(null)}
        household={editingHousehold}
        setHousehold={setEditingHousehold}
        onRename={handleRenameHousehold}
        isPending={isPending}
        onDelete={() => {
          if (
            window.confirm(
              `Möchtest du "${editingHousehold.name}" wirklich löschen?`
            )
          ) {
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
          }
        }}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        onInvite={(e) => {
          e.preventDefault();
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
          if (window.confirm(`${email} wirklich aus dem Haushalt entfernen?`)) {
            startTransition(async () => {
              await removeMemberAction(editingHousehold.id, email);
              refreshMembers(editingHousehold.id);
            });
          }
        }}
        currentUserEmail={session?.email}
      />

      <ProfileDialog
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setProfileError("");
          setProfileSuccess(false);
        }}
        userProfile={userProfile}
        profileData={profileData}
        setProfileData={setProfileData}
        profileError={profileError}
        profileSuccess={profileSuccess}
        isPending={isPending}
        onSave={() => {
          setProfileError("");
          setProfileSuccess(false);
          startTransition(async () => {
            try {
              await updateProfile(profileData);
              setProfileSuccess(true);
              setProfileData((prev) => ({
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
        onLogout={() => {
          startTransition(async () => {
            await logoutAction();
            setSession(null);
            setIsProfileOpen(false);
          });
        }}
      />
    </main>
  );
}
