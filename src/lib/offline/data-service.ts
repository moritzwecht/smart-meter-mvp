import { db } from '@/lib/offline/db';
import { SyncManager } from '@/lib/offline/sync-manager';
import * as actions from '@/app/actions';

export const DataService = {
    async getHouseholds() {
        if (navigator.onLine) {
            try {
                const remote = await actions.getHouseholds();
                // Sync to local
                await db.households.clear();
                await db.households.bulkAdd(remote);
                return remote;
            } catch (e) {
                console.error("Failed to fetch remote households", e);
            }
        }
        return await db.households.toArray();
    },

    async getWidgets(householdId: number, lockedIds?: { meters?: number[], lists?: number[], notes?: number[] }) {
        if (navigator.onLine) {
            try {
                const [m, l, n] = await Promise.all([
                    actions.getMeters(householdId),
                    actions.getTodoLists(householdId),
                    actions.getNotes(householdId)
                ]);

                // Get pending IDs to avoid overwriting local drafts
                const pendingOps = await db.syncQueue.toArray();
                const pendingIds = {
                    METER: new Set([
                        ...pendingOps.filter(o => o.entity === 'METER').map(o => (o.data as any).id || (o.data as any).tempId),
                        ...(lockedIds?.meters || [])
                    ]),
                    LIST: new Set([
                        ...pendingOps.filter(o => o.entity === 'LIST').map(o => (o.data as any).id || (o.data as any).tempId),
                        ...(lockedIds?.lists || [])
                    ]),
                    NOTE: new Set([
                        ...pendingOps.filter(o => o.entity === 'NOTE').map(o => (o.data as any).id || (o.data as any).tempId),
                        ...(lockedIds?.notes || [])
                    ]),
                };

                // Surgical update to avoid flicker and respect drafts
                await db.transaction('rw', [db.meters, db.todoLists, db.notes, db.readings, db.todoItems], async () => {
                    // Update Meters
                    const serverMeterIds = new Set(m.map(i => i.id));
                    await db.meters.where('householdId').equals(householdId)
                        .filter(local => local.id > 0 && !serverMeterIds.has(local.id) && !pendingIds.METER.has(local.id))
                        .delete();
                    await db.meters.bulkPut(m.filter(i => !pendingIds.METER.has(i.id)));

                    // Update Lists
                    const serverListIds = new Set(l.map(i => i.id));
                    await db.todoLists.where('householdId').equals(householdId)
                        .filter(local => local.id > 0 && !serverListIds.has(local.id) && !pendingIds.LIST.has(local.id))
                        .delete();
                    await db.todoLists.bulkPut(l.filter(i => !pendingIds.LIST.has(i.id)));

                    // Update Notes
                    const serverNoteIds = new Set(n.map(i => i.id));
                    await db.notes.where('householdId').equals(householdId)
                        .filter(local => local.id > 0 && !serverNoteIds.has(local.id) && !pendingIds.NOTE.has(local.id))
                        .delete();
                    await db.notes.bulkPut(n.filter(i => !pendingIds.NOTE.has(i.id)));

                    // Also sync sub-entities (readings and items)
                    for (const meter of m) {
                        if (meter.readings) {
                            const sIds = new Set(meter.readings.map(r => r.id));
                            await db.readings.where('meterId').equals(meter.id)
                                .filter(local => local.id > 0 && !sIds.has(local.id))
                                .delete();
                            await db.readings.bulkPut(meter.readings);
                        }
                    }
                    for (const list of l) {
                        if (list.items) {
                            const sIds = new Set(list.items.map(i => i.id));
                            await db.todoItems.where('listId').equals(list.id)
                                .filter(local => local.id > 0 && !sIds.has(local.id))
                                .delete();
                            await db.todoItems.bulkPut(list.items);
                        }
                    }
                });

                const all = [
                    ...m.map(i => ({ ...i, widgetType: 'METER' as const })),
                    ...l.map(i => ({ ...i, widgetType: 'LIST' as const })),
                    ...n.map(i => ({ ...i, widgetType: 'NOTE' as const }))
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                return all;
            } catch (e) {
                console.error("Failed to fetch remote widgets", e);
            }
        }

        // Offline / Failed Remote
        const [m, l, n] = await Promise.all([
            db.meters.where('householdId').equals(householdId).toArray(),
            db.todoLists.where('householdId').equals(householdId).toArray(),
            db.notes.where('householdId').equals(householdId).toArray()
        ]);

        const all = [
            ...m.map(i => ({ ...i, widgetType: 'METER' as const })),
            ...l.map(i => ({ ...i, widgetType: 'LIST' as const })),
            ...n.map(i => ({ ...i, widgetType: 'NOTE' as const }))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return all;
    },

    async addReading(meterId: number, value: string, date: Date) {
        const tempId = Math.floor(Math.random() * -1000000); // Negative temporary ID
        const reading = { id: tempId, meterId, value, date, createdAt: new Date() };

        await db.readings.add(reading);
        await SyncManager.enqueue({
            type: 'CREATE',
            entity: 'READING',
            data: { meterId, value, date, tempId }
        });

        return reading;
    },

    async deleteReading(id: number) {
        await db.readings.delete(id);
        await SyncManager.enqueue({
            type: 'DELETE',
            entity: 'READING',
            data: { id }
        });
    },

    async addNote(householdId: number, title: string, content?: string) {
        const tempId = Math.floor(Math.random() * -1000000);
        const note = { id: tempId, householdId, title, content: content || null, isPinned: 'false', createdAt: new Date() };

        await db.notes.add(note);
        await SyncManager.enqueue({
            type: 'CREATE',
            entity: 'NOTE',
            data: { householdId, title, content, tempId }
        });

        return note;
    },

    async updateNote(id: number, title: string, content?: string) {
        await db.notes.update(id, { title, content: content || null });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'NOTE',
            data: { id, title, content }
        });
    },

    async deleteNote(id: number) {
        await db.notes.delete(id);
        await SyncManager.enqueue({
            type: 'DELETE',
            entity: 'NOTE',
            data: { id }
        });
    },

    async addTodoList(householdId: number, name: string) {
        const tempId = Math.floor(Math.random() * -1000000);
        const list = { id: tempId, householdId, name, isPinned: 'false', createdAt: new Date(), items: [] };

        await db.todoLists.add(list);
        await SyncManager.enqueue({
            type: 'CREATE',
            entity: 'LIST',
            data: { householdId, name, tempId }
        });

        return list;
    },

    async updateTodoList(id: number, name: string) {
        await db.todoLists.update(id, { name });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'LIST',
            data: { id, name }
        });
    },

    async deleteTodoList(id: number) {
        await db.todoLists.delete(id);
        await SyncManager.enqueue({
            type: 'DELETE',
            entity: 'LIST',
            data: { id }
        });
    },

    async addTodoItem(listId: number, content: string) {
        const tempId = Math.floor(Math.random() * -1000000);
        const item = { id: tempId, listId, content, completed: 'false', createdAt: new Date() };

        await db.todoItems.add(item);
        await SyncManager.enqueue({
            type: 'CREATE',
            entity: 'ITEM',
            data: { listId, content, tempId }
        });

        return item;
    },

    async toggleTodoItem(id: number, completed: string) {
        await db.todoItems.update(id, { completed });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'ITEM',
            data: { id, completed }
        });
    },

    async deleteTodoItem(id: number) {
        await db.todoItems.delete(id);
        await SyncManager.enqueue({
            type: 'DELETE',
            entity: 'ITEM',
            data: { id }
        });
    },

    async addMeter(householdId: number, type: string, unit: string) {
        const tempId = Math.floor(Math.random() * -1000000);
        const name = type === "ELECTRICITY" ? "Strom" : type === "WATER" ? "Wasser" : type === "GAS" ? "Gas" : "Zähler";
        const meter = { id: tempId, householdId, name, type, unit, isPinned: 'false', createdAt: new Date(), readings: [] };

        await db.meters.add(meter);
        await SyncManager.enqueue({
            type: 'CREATE',
            entity: 'METER',
            data: { householdId, type, unit, tempId }
        });

        return meter;
    },

    async updateMeter(id: number, type: string, unit: string) {
        const name = type === "ELECTRICITY" ? "Strom" : type === "WATER" ? "Wasser" : type === "GAS" ? "Gas" : "Zähler";
        await db.meters.update(id, { name, type, unit });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'METER',
            data: { id, type, unit }
        });
    },

    async deleteMeter(id: number) {
        await db.meters.delete(id);
        await SyncManager.enqueue({
            type: 'DELETE',
            entity: 'METER',
            data: { id }
        });
    },

    async toggleMeterPin(id: number, isPinned: string) {
        await db.meters.update(id, { isPinned });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'METER',
            data: { id, isPinned, type: 'TOGGLE_PIN' }
        });
    },

    async toggleNotePin(id: number, isPinned: string) {
        await db.notes.update(id, { isPinned });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'NOTE',
            data: { id, isPinned, type: 'TOGGLE_PIN' }
        });
    },

    async toggleTodoListPin(id: number, isPinned: string) {
        await db.todoLists.update(id, { isPinned });
        await SyncManager.enqueue({
            type: 'UPDATE',
            entity: 'LIST',
            data: { id, isPinned, type: 'TOGGLE_PIN' }
        });
    }
};
