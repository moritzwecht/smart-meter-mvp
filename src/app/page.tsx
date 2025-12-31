"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { logout as logoutAction, getHouseholds as getHouseholdsAction, createHousehold as createHouseholdAction, deleteHousehold as deleteHouseholdAction, getMeters, getTodoLists, getNotes, addNote, addMeter, addTodoList, updateNote, deleteNote, updateTodoList, deleteTodoList, addTodoItem, toggleTodoItem, deleteTodoItem, updateMeter, deleteMeter, addReading, deleteReading, inviteToHousehold, getHouseholdMembers } from "./actions";

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
    if (selectedHouseholdId) refreshWidgets(selectedHouseholdId);
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
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm border border-black p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">My Home</h1>
            <p className="text-sm border-t border-black/10 pt-1">v0.1.0</p>
          </div>
          <LoginForm />
        </div>
      </main>
    );
  }

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto space-y-12">
      <header className="flex justify-between items-start border-b-2 border-black pb-6">
        <div className="relative">
          <button
            onClick={() => setIsHouseholdMenuOpen(!isHouseholdMenuOpen)}
            className="group flex items-baseline gap-3 text-3xl font-black uppercase tracking-tighter hover:opacity-70 transition-opacity"
          >
            {selectedHousehold ? selectedHousehold.name : "Wähle Haushalt"}
            <span className="text-sm font-normal normal-case opacity-30 group-hover:opacity-100">▼ Wechseln</span>
          </button>

          {isHouseholdMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white border-2 border-black z-50 p-2 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-30 px-2 pb-1 border-b border-black/10">Deine Haushalte</div>
              {households.map(h => (
                <div key={h.id} className="flex group/household">
                  <button
                    onClick={() => {
                      setSelectedHouseholdId(h.id);
                      setIsHouseholdMenuOpen(false);
                    }}
                    className={`flex-1 text-left px-2 py-1.5 font-bold uppercase text-sm hover:bg-black hover:text-white transition-colors ${h.id === selectedHouseholdId ? 'bg-slate-100' : ''}`}
                  >
                    {h.name}
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Möchtest du den Haushalt "${h.name}" wirklich löschen? Alle Daten gehen verloren.`)) {
                        try {
                          await deleteHouseholdAction(h.id);
                          if (selectedHouseholdId === h.id) {
                            setSelectedHouseholdId(null);
                          }
                          refreshHouseholds();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }
                    }}
                    className="px-3 hover:bg-red-600 hover:text-white transition-colors text-red-600"
                    title="Haushalt löschen"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <div className="border-t border-black/10 pt-2 px-2">
                <form onSubmit={handleCreateHousehold} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Neuer Haushalt..."
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    className="w-full text-xs border-b border-black outline-none bg-transparent"
                  />
                  <button type="submit" className="text-[10px] font-black uppercase tracking-widest hover:underline">
                    + Hinzufügen
                  </button>
                </form>
              </div>

              {selectedHouseholdId && (
                <div className="border-t border-black/10 pt-2 px-2 pb-1">
                  <button
                    onClick={() => {
                      setShowManageMembers(true);
                      setIsHouseholdMenuOpen(false);
                      refreshMembers(selectedHouseholdId);
                    }}
                    className="w-full text-left font-black uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100"
                  >
                    👥 Mitglieder verwalten
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            await logoutAction();
            setSession(null);
          }}
          className="px-4 py-2 border border-black text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          Logout
        </button>
      </header>

      {selectedHousehold ? (
        <div className="space-y-12">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Dashboard Widgets</h2>
            <button
              onClick={() => setShowAddWidget(!showAddWidget)}
              className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              {showAddWidget ? "Abbrechen" : "+ Widget hinzufügen"}
            </button>
          </div>

          {showAddWidget && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 border-2 border-dashed border-black">
              {[
                { type: 'METER', icon: '⚡', label: 'Zähler', desc: 'Strom, Gas, Wasser' },
                { type: 'LIST', icon: '✓', label: 'Liste', desc: 'Todo-Listen' },
                { type: 'NOTE', icon: '✎', label: 'Notiz', desc: 'Schnelle Notizen' },
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={async () => {
                    if (opt.type === 'NOTE') await addNote(selectedHouseholdId!, "Neue Notiz");
                    if (opt.type === 'METER') await addMeter(selectedHouseholdId!, "Neuer Zähler", "ELECTRICITY", "kWh");
                    if (opt.type === 'LIST') await addTodoList(selectedHouseholdId!, "Neue Liste");
                    setShowAddWidget(false);
                    refreshWidgets(selectedHouseholdId!);
                  }}
                  className="p-6 border border-black hover:bg-slate-50 text-left group transition-all"
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className="font-black uppercase">{opt.label}</div>
                  <div className="text-xs opacity-50 mb-4">{opt.desc}</div>
                  <div className="text-[10px] font-bold uppercase underline group-hover:no-underline">Hinzufügen →</div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {widgets.map((w, i) => (
              <div key={i} className="border-2 border-black p-6 flex flex-col gap-4 group">
                <div className="flex justify-between items-start">
                  <div className="px-2 py-0.5 border border-black text-[9px] font-black uppercase tracking-widest">
                    {w.widgetType}
                  </div>
                  <div className="text-[9px] font-mono opacity-30 uppercase">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">{w.name || w.title}</h3>
                  {w.widgetType === 'NOTE' && <p className="text-sm opacity-60 italic mt-1">{w.content || "Kein Inhalt..."}</p>}
                  {w.widgetType === 'LIST' && (
                    <div className="mt-2 space-y-1">
                      {w.items?.slice(0, 3).map((item: any) => (
                        <div key={item.id} className="text-[10px] font-mono flex items-center gap-2">
                          <span className="opacity-30">{item.completed === 'true' ? '☑' : '☐'}</span>
                          <span className={`${item.completed === 'true' ? 'line-through opacity-30' : ''}`}>{item.content}</span>
                        </div>
                      ))}
                      {w.items?.length > 3 && <div className="text-[9px] opacity-30 mt-1">+{w.items.length - 3} weitere...</div>}
                      {(!w.items || w.items.length === 0) && <p className="text-[10px] opacity-30 italic mt-1">Keine Punkte...</p>}
                    </div>
                  )}
                  {w.widgetType === 'METER' && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-mono">
                        <span className="opacity-40 uppercase tracking-widest text-[10px]">Einheit:</span> {w.unit}
                      </div>
                      <div className="text-xs font-mono">
                        <span className="opacity-40 uppercase tracking-widest text-[10px]">Stand:</span> {w.readings?.length > 0 ? (
                          <span className="font-bold underline">{w.readings.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].value}</span>
                        ) : (
                          <span className="opacity-30 italic">Keine Daten</span>
                        )}
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
                            <div className="text-[10px] font-mono mt-2 pt-2 border-t border-black/5">
                              <span className="opacity-40 uppercase tracking-widest">Ø Tag:</span> <span className="font-bold text-green-700">{avg} {w.unit}/Tag</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-black/5 flex justify-between items-center">
                  <div className="flex gap-4">
                    {w.widgetType === 'NOTE' || w.widgetType === 'LIST' || w.widgetType === 'METER' ? (
                      <button
                        onClick={() => {
                          if (w.widgetType === 'NOTE') setEditingNote(w);
                          if (w.widgetType === 'LIST') setEditingList(w);
                          if (w.widgetType === 'METER') setEditingMeter(w);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest underline hover:no-underline"
                      >
                        Bearbeiten
                      </button>
                    ) : (
                      <button className="text-[10px] font-black uppercase tracking-widest underline hover:no-underline">
                        Details öffnen
                      </button>
                    )}
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
                    className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}

            {widgets.length === 0 && !showAddWidget && (
              <div className="col-span-full py-24 border-2 border-dashed border-black/10 flex flex-col items-center justify-center text-center gap-4">
                <p className="font-bold opacity-20 uppercase tracking-[0.3em]">No Widgets Active</p>
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="text-xs font-bold uppercase underline hover:no-underline"
                >
                  Create your first widget
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-24 text-center border-2 border-dashed border-black/20">
          <p className="font-bold uppercase tracking-widest opacity-30">Wähle oder erstelle einen Haushalt</p>
        </div>
      )}

      {editingNote && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-2xl border-4 border-black bg-white p-8 space-y-6">
            <div className="flex justify-between items-center border-b-2 border-black pb-4">
              <h2 className="text-2xl font-black uppercase">Notiz bearbeiten</h2>
              <button
                onClick={() => setEditingNote(null)}
                className="text-xs font-bold uppercase underline"
              >
                Schließen
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Titel</label>
                <input
                  type="text"
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full text-xl font-bold uppercase border-b-2 border-black/10 focus:border-black outline-none bg-transparent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Inhalt</label>
                <textarea
                  rows={8}
                  value={editingNote.content || ""}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  className="w-full border-2 border-black/10 focus:border-black outline-none p-4 bg-transparent resize-none font-mono text-sm"
                  placeholder="Schreibe etwas..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={async () => {
                  await updateNote(editingNote.id, editingNote.title, editingNote.content);
                  setEditingNote(null);
                  refreshWidgets(selectedHouseholdId!);
                }}
                className="flex-1 py-4 bg-black text-white font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditingNote(null)}
                className="flex-1 py-4 border-2 border-black font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      {editingList && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-black">
          <div className="w-full max-w-2xl border-4 border-black bg-white p-8 space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b-2 border-black pb-4">
              <h2 className="text-2xl font-black uppercase">Liste bearbeiten</h2>
              <button
                onClick={() => setEditingList(null)}
                className="text-xs font-bold uppercase underline"
              >
                Fertig
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 pb-6 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Name der Liste</label>
                <input
                  type="text"
                  value={editingList.name}
                  onChange={async (e) => {
                    const newName = e.target.value;
                    setEditingList({ ...editingList, name: newName });
                  }}
                  onBlur={async () => {
                    await updateTodoList(editingList.id, editingList.name);
                    refreshWidgets(selectedHouseholdId!);
                  }}
                  className="w-full text-xl font-bold uppercase border-b-2 border-black/10 focus:border-black outline-none bg-transparent"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Listenpunkte</label>

                <div className="space-y-3">
                  {editingList.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 group">
                      <button
                        onClick={async () => {
                          const newStatus = item.completed === 'true' ? 'false' : 'true';
                          await toggleTodoItem(item.id, newStatus);
                          refreshWidgets(selectedHouseholdId!);
                        }}
                        className={`w-6 h-6 border-2 border-black flex items-center justify-center transition-colors ${item.completed === 'true' ? 'bg-black text-white' : 'hover:bg-slate-50'}`}
                      >
                        {item.completed === 'true' && '✓'}
                      </button>
                      <span className={`flex-1 font-mono text-sm ${item.completed === 'true' ? 'line-through opacity-30' : ''}`}>
                        {item.content}
                      </span>
                      <button
                        onClick={async () => {
                          await deleteTodoItem(item.id);
                          refreshWidgets(selectedHouseholdId!);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase tracking-widest text-red-600 underline"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newItemValue.trim()) return;
                      await addTodoItem(editingList.id, newItemValue);
                      setNewItemValue("");
                      refreshWidgets(selectedHouseholdId!);
                    }}
                    className="flex gap-4 pt-4 border-t border-black/5"
                  >
                    <input
                      type="text"
                      placeholder="Neuer Punkt..."
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      className="flex-1 bg-transparent border-b border-black outline-none py-1 text-sm font-mono"
                    />
                    <button type="submit" className="text-xs font-black uppercase tracking-widest underline hover:no-underline">
                      Hinzufügen
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-black">
              <button
                onClick={() => setEditingList(null)}
                className="w-full py-4 bg-black text-white font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {editingMeter && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-black">
          <div className="w-full max-w-2xl border-4 border-black bg-white p-8 space-y-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b-2 border-black pb-4">
              <h2 className="text-2xl font-black uppercase">Zähler bearbeiten</h2>
              <button
                onClick={() => setEditingMeter(null)}
                className="text-xs font-bold uppercase underline"
              >
                Fertig
              </button>
            </div>

            <div className="space-y-8 overflow-y-auto pr-2 pb-6 flex-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Name</label>
                  <input
                    type="text"
                    value={editingMeter.name}
                    onChange={(e) => setEditingMeter({ ...editingMeter, name: e.target.value })}
                    onBlur={() => {
                      updateMeter(editingMeter.id, editingMeter.name, editingMeter.unit);
                      refreshWidgets(selectedHouseholdId!);
                    }}
                    className="w-full text-lg font-bold uppercase border-b-2 border-black/10 focus:border-black outline-none bg-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Einheit</label>
                  <input
                    type="text"
                    value={editingMeter.unit}
                    onChange={(e) => setEditingMeter({ ...editingMeter, unit: e.target.value })}
                    onBlur={() => {
                      updateMeter(editingMeter.id, editingMeter.name, editingMeter.unit);
                      refreshWidgets(selectedHouseholdId!);
                    }}
                    className="w-full text-lg font-bold uppercase border-b-2 border-black/10 focus:border-black outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Verbrauch</label>
                <div className="p-4 bg-slate-50 border border-black/10 grid grid-cols-2 gap-4">
                  {editingMeter.readings?.length >= 2 ? (() => {
                    const sorted = [...editingMeter.readings].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const first = sorted[0];
                    const last = sorted[sorted.length - 1];
                    const diff = parseFloat(last.value) - parseFloat(first.value);
                    const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
                    const avg = days > 0 ? (diff / days).toFixed(2) : "0.00";
                    return (
                      <>
                        <div className="space-y-0.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] opacity-40">Gesamt ({Math.floor(days)} Tage)</div>
                          <div className="text-lg font-bold font-mono">{diff.toFixed(2)} {editingMeter.unit}</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-[9px] uppercase tracking-[0.2em] opacity-40">Ø pro Tag</div>
                          <div className="text-lg font-bold font-mono text-green-700">{avg} {editingMeter.unit}</div>
                        </div>
                      </>
                    );
                  })() : (
                    <div className="col-span-2 text-center py-2 text-[10px] opacity-30 italic">
                      Mindestens zwei Ablesungen für Statistik benötigt...
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Neuer Zählerstand</label>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newItemValue.trim()) return;
                    await addReading(editingMeter.id, newItemValue, new Date());
                    setNewItemValue("");
                    refreshWidgets(selectedHouseholdId!);
                  }}
                  className="flex gap-4 p-4 border-2 border-black"
                >
                  <input
                    type="text"
                    placeholder="Wert..."
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    className="flex-1 bg-transparent border-b border-black outline-none py-1 text-xl font-bold font-mono"
                  />
                  <button type="submit" className="px-6 py-2 bg-black text-white text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity">
                    Speichern
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Historie</label>
                <div className="border border-black divide-y divide-black">
                  {editingMeter.readings && editingMeter.readings.length > 0 ? (
                    editingMeter.readings
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((r: any) => (
                        <div key={r.id} className="flex justify-between items-center p-3 font-mono text-sm group">
                          <div className="flex gap-4">
                            <span className="opacity-30">{new Date(r.date).toLocaleDateString()}</span>
                            <span className="font-bold">{r.value} {editingMeter.unit}</span>
                          </div>
                          <button
                            onClick={async () => {
                              if (window.confirm("Ablesung löschen?")) {
                                await deleteReading(r.id);
                                refreshWidgets(selectedHouseholdId!);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase text-red-600 underline"
                          >
                            Löschen
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="p-8 text-center text-xs opacity-30 italic">Noch keine Ablesungen vorhanden...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-black">
              <button
                onClick={() => setEditingMeter(null)}
                className="w-full py-4 bg-black text-white font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Member Management Overlay */}
      {showManageMembers && selectedHousehold && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border-2 border-black p-8 space-y-8 relative overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={() => setShowManageMembers(false)}
              className="absolute top-4 right-4 text-2xl font-black hover:scale-110 transition-transform"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Mitglieder</h2>
              <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Haushalt: {selectedHousehold.name}</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Neues Mitglied einladen</label>
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
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="E-Mail Adresse..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border-b-2 border-black font-mono text-sm outline-none focus:bg-slate-50"
                  />
                  <button type="submit" className="px-4 py-2 bg-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-colors">
                    Senden
                  </button>
                </div>
                {inviteError && <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight italic">{inviteError}</p>}
              </form>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Aktuelle Mitglieder</label>
              <div className="border border-black/10 divide-y divide-black/5">
                {members.map((m, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center group hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold">{m.email}</div>
                      <div className="text-[9px] font-mono uppercase tracking-widest opacity-30">{m.role === 'OWNER' ? 'Besitzer' : 'Mitglied'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowManageMembers(false)}
              className="w-full py-3 border border-black font-black uppercase text-xs tracking-[0.2em] hover:bg-black hover:text-white transition-all"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
