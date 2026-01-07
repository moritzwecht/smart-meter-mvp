import { db, type SyncOperation } from './db';
import * as actions from '@/app/actions';

export class SyncManager {
    private static isSyncing = false;

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
                    await this.processOperation(op);
                    await db.syncQueue.delete(op.id!);
                } catch (error) {
                    console.error("Sync failed for operation", op, error);
                    await db.syncQueue.update(op.id!, { status: 'FAILED' });
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private static async processOperation(op: SyncOperation) {
        const { type, entity, data } = op;

        switch (entity) {
            case 'READING':
                if (type === 'CREATE') await actions.addReading(data.meterId, data.value, new Date(data.date));
                if (type === 'DELETE') await actions.deleteReading(data.id);
                break;
            case 'NOTE':
                if (type === 'CREATE') await actions.addNote(data.householdId, data.title, data.content);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        await actions.toggleNotePin(data.id, data.isPinned);
                    } else {
                        await actions.updateNote(data.id, data.title, data.content);
                    }
                }
                if (type === 'DELETE') await actions.deleteNote(data.id);
                break;
            case 'LIST':
                if (type === 'CREATE') await actions.addTodoList(data.householdId, data.name);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        await actions.toggleTodoListPin(data.id, data.isPinned);
                    } else {
                        await actions.updateTodoList(data.id, data.name);
                    }
                }
                if (type === 'DELETE') await actions.deleteTodoList(data.id);
                break;
            case 'ITEM':
                if (type === 'CREATE') await actions.addTodoItem(data.listId, data.content);
                if (type === 'UPDATE') await actions.toggleTodoItem(data.id, data.completed);
                if (type === 'DELETE') await actions.deleteTodoItem(data.id);
                break;
            case 'METER':
                if (type === 'CREATE') await actions.addMeter(data.householdId, data.type, data.unit);
                if (type === 'UPDATE') {
                    if (data.type === 'TOGGLE_PIN') {
                        await actions.toggleMeterPin(data.id, data.isPinned);
                    } else {
                        await actions.updateMeter(data.id, data.type, data.unit);
                    }
                }
                if (type === 'DELETE') await actions.deleteMeter(data.id);
                break;
        }
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => SyncManager.sync());
}
