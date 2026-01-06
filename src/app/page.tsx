"use client";

import { useEffect, useState } from "react";
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
            onAddWidget={async (type) => {
              if (type === "NOTE")
                await addNote(selectedHouseholdId!, "Neue Notiz");
              if (type === "METER") {
                setNewMeterData({
                  name: "Neuer Zähler",
                  type: "ELECTRICITY",
                  unit: "kWh",
                });
                setShowAddMeterDialog(true);
              }
              if (type === "LIST")
                await addTodoList(selectedHouseholdId!, "Neue Liste");
              setShowAddWidget(false);
              refreshWidgets(selectedHouseholdId!);
            }}
          />

          {widgets.length > 0 ? (
            <div className="space-y-12">
              {/* Meters Section */}
              {widgets.some((w) => w.widgetType === "METER") && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {widgets
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
              {widgets.some((w) => w.widgetType !== "METER") && (
                <div className="space-y-4">
                  <div className="px-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">
                      Listen & Notizen
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <AnimatePresence mode="popLayout">
                      {widgets
                        .filter((w) => w.widgetType !== "METER")
                        .map((w) => (
                          <div key={w.id}>
                            {w.widgetType === "NOTE" && (
                              <NoteWidget
                                note={w}
                                onEdit={() => setEditingNote(w)}
                                onDelete={async () => {
                                  if (window.confirm("Wirklich löschen?")) {
                                    await deleteNote(w.id);
                                    refreshWidgets(selectedHouseholdId!);
                                  }
                                }}
                              />
                            )}
                            {w.widgetType === "LIST" && (
                              <ListWidget
                                list={w}
                                onEdit={() => setEditingList(w)}
                                onDelete={async () => {
                                  if (window.confirm("Wirklich löschen?")) {
                                    await deleteTodoList(w.id);
                                    refreshWidgets(selectedHouseholdId!);
                                  }
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
        onAdd={async () => {
          await addMeter(
            selectedHouseholdId!,
            newMeterData.name,
            newMeterData.type,
            newMeterData.unit
          );
          setShowAddMeterDialog(false);
          refreshWidgets(selectedHouseholdId!);
        }}
      />

      <MeterReadingDialog
        isOpen={!!addingReadingForMeter}
        onClose={() => setAddingReadingForMeter(null)}
        meter={addingReadingForMeter}
        value={newItemValue}
        setValue={setNewItemValue}
        onSave={async (e) => {
          e.preventDefault();
          if (!newItemValue.trim()) return;
          await addReading(addingReadingForMeter.id, newItemValue, new Date());
          setNewItemValue("");
          setAddingReadingForMeter(null);
          refreshWidgets(selectedHouseholdId!);
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
        onSave={async () => {
          await updateNote(
            editingNote.id,
            editingNote.title,
            editingNote.content
          );
          setEditingNote(null);
          refreshWidgets(selectedHouseholdId!);
        }}
      />

      <ListEditDialog
        isOpen={!!editingList}
        list={editingList}
        setList={setEditingList}
        onClose={() => setEditingList(null)}
        onUpdateList={async (id, name) => {
          await updateTodoList(id, name);
          refreshWidgets(selectedHouseholdId!);
        }}
        onAddItem={async (content) => {
          await addTodoItem(editingList.id, content);
          refreshWidgets(selectedHouseholdId!);
        }}
        onToggleItem={async (id, status) => {
          await toggleTodoItem(id, status);
          refreshWidgets(selectedHouseholdId!);
        }}
        onDeleteItem={async (id) => {
          await deleteTodoItem(id);
          refreshWidgets(selectedHouseholdId!);
        }}
        newItemValue={newItemValue}
        setNewItemValue={setNewItemValue}
      />

      <MeterSettingsDialog
        isOpen={!!editingMeter}
        onClose={() => setEditingMeter(null)}
        meter={editingMeter}
        onUpdateMeter={async (id, name, type, unit) => {
          await updateMeter(id, name, type, unit);
          refreshWidgets(selectedHouseholdId!);
        }}
        onDeleteReading={async (id) => {
          if (window.confirm("Ablesung löschen?")) {
            await deleteReading(id);
            refreshWidgets(selectedHouseholdId!);
          }
        }}
      />

      <HouseholdSettingsDialog
        isOpen={!!editingHousehold}
        onClose={() => setEditingHousehold(null)}
        household={editingHousehold}
        setHousehold={setEditingHousehold}
        onRename={handleRenameHousehold}
        onDelete={async () => {
          if (
            window.confirm(
              `Möchtest du "${editingHousehold.name}" wirklich löschen?`
            )
          ) {
            try {
              await deleteHouseholdAction(editingHousehold.id);
              if (selectedHouseholdId === editingHousehold.id)
                setSelectedHouseholdId(null);
              setEditingHousehold(null);
              refreshHouseholds();
            } catch (err: any) {
              alert(err.message);
            }
          }
        }}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        onInvite={async (e) => {
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
        inviteError={inviteError}
        members={members}
        onRemoveMember={async (email) => {
          if (window.confirm(`${email} wirklich aus dem Haushalt entfernen?`)) {
            await removeMemberAction(editingHousehold.id, email);
            refreshMembers(editingHousehold.id);
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
        onSave={async () => {
          setProfileError("");
          setProfileSuccess(false);
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
        }}
        onLogout={async () => {
          await logoutAction();
          setSession(null);
          setIsProfileOpen(false);
        }}
      />
    </main>
  );
}
