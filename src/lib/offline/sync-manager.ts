import { db, type SyncOperation } from './db';
import * as actions from '@/app/actions';

export class SyncManager {
    private static isSyncing = false;
    private static listeners: ((entity: string, oldId: number, newId: number) => void)[] = [];

    static subscribe(cb: (entity: string, oldId: number, newId: number) => void) {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    static async enqueue(operation: Omit<SyncOperation, 'timestamp' | 'status'>) {
        await db.syncQueue.add({
            ...operation,
            timestamp: Date.now(),
            status: 'PENDING'
        });
        this.sync();
    }

    static async sync() {
        if (this.isSyncing || !navigator.onLine) return;
        this.isSyncing = true;

        try {
            const pending = await db.syncQueue
                .where('status')
                .equals('PENDING')
                .sortBy('timestamp');

            for (const op of pending) {
                try {
                    await db.syncQueue.update(op.id!, { status: 'SYNCING' });
                    const result = await this.processOperation(op);

                    if (result && (op.type === 'CREATE')) {
                        const newId = (result as any).id;
                        const oldId = (op.data as any).tempId;

                        if (oldId && newId) {
                            await this.updateLocalId(op.entity, oldId, newId);
                            await this.remapQueueIds(op.entity, oldId, newId);
                        }
                    }

                    await db.syncQueue.delete(op.id!);
                } catch (e) {
                    console.error("Operation sync failed", e);
                    await db.syncQueue.update(op.id!, { status: 'PENDING' });
                    break;
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private static async updateLocalId(entity: string, oldId: number, newId: number) {
        if (!oldId || oldId >= 0) return;

        try {
            switch (entity) {
                case 'READING':
                    const r = await db.readings.get(oldId);
                    if (r) { await db.readings.delete(oldId); await db.readings.add({ ...r, id: newId }); }
                    break;
                case 'NOTE':
                    const n = await db.notes.get(oldId);
                    if (n) { await db.notes.delete(oldId); await db.notes.add({ ...n, id: newId }); }
                    break;
                case 'LIST':
                    const l = await db.todoLists.get(oldId);
                    if (l) { await db.todoLists.delete(oldId); await db.todoLists.add({ ...l, id: newId }); }
                    break;
                case 'ITEM':
                    const i = await db.todoItems.get(oldId);
                    if (i) { await db.todoItems.delete(oldId); await db.todoItems.add({ ...i, id: newId }); }
                    break;
                case 'METER':
                    const m = await db.meters.get(oldId);
                    if (m) { await db.meters.delete(oldId); await db.meters.add({ ...m, id: newId }); }
                    break;
            }
            // Notify listeners about remapping
            this.listeners.forEach(l => l(entity, oldId, newId));
        } catch (e) {
            console.error("Failed to update local ID", e);
        }
    }

    private static async remapQueueIds(entity: string, oldId: number, newId: number) {
        const pending = await db.syncQueue.where('status').equals('PENDING').toArray();
        for (const op of pending) {
            let changed = false;
            const data = { ...op.data };

            if (op.entity === entity && data.id === oldId) {
                data.id = newId;
                changed = true;
            }

            if (entity === 'METER' && data.meterId === oldId) { data.meterId = newId; changed = true; }
            if (entity === 'LIST' && data.listId === oldId) { data.listId = newId; changed = true; }

            if (changed) {
                await db.syncQueue.update(op.id!, { data });
            }
        }
    }

    private static async processOperation(op: SyncOperation) {
        const { type, entity, data } = op;

        switch (entity) {
            case 'READING':
                if (type === 'CREATE') return await actions.addReading(data.meterId, data.value, new Date(data.date));
                if (type === 'DELETE') return await actions.deleteReading(data.id);
                break;
            case 'NOTE':
                if (type === 'CREATE') return await actions.addNote(data.householdId, data.title, data.content);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        return await actions.toggleNotePin(data.id, data.isPinned);
                    } else {
                        return await actions.updateNote(data.id, data.title, data.content);
                    }
                }
                if (type === 'DELETE') return await actions.deleteNote(data.id);
                break;
            case 'LIST':
                if (type === 'CREATE') return await actions.addTodoList(data.householdId, data.name);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        return await actions.toggleTodoListPin(data.id, data.isPinned);
                    } else {
                        return await actions.updateTodoList(data.id, data.name);
                    }
                }
                if (type === 'DELETE') return await actions.deleteTodoList(data.id);
                break;
            case 'ITEM':
                if (type === 'CREATE') return await actions.addTodoItem(data.listId, data.content);
                if (type === 'UPDATE') return await actions.toggleTodoItem(data.id, data.completed);
                if (type === 'DELETE') return await actions.deleteTodoItem(data.id);
                break;
            case 'METER':
                if (type === 'CREATE') return await actions.addMeter(data.householdId, data.type, data.unit);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        return await actions.toggleMeterPin(data.id, data.isPinned);
                    } else {
                        return await actions.updateMeter(data.id, data.type, data.unit);
                    }
                }
                if (type === 'DELETE') return await actions.deleteMeter(data.id);
                break;
        }
    }
}
