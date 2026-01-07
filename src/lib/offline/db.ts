import Dexie, { type Table } from 'dexie';

export interface OfflineHousehold {
    id: number;
    name: string;
    userId: number;
    createdAt: Date;
    role?: string;
}

export interface OfflineMeter {
    id: number;
    name: string;
    type: string;
    householdId: number;
    unit: string;
    isPinned: string;
    createdAt: Date;
}

export interface OfflineReading {
    id: number;
    meterId: number;
    value: string;
    date: Date;
    createdAt: Date;
}

export interface OfflineTodoList {
    id: number;
    name: string;
    householdId: number;
    isPinned: string;
    createdAt: Date;
}

export interface OfflineTodoItem {
    id: number;
    listId: number;
    content: string;
    completed: string;
    createdAt: Date;
}

export interface OfflineNote {
    id: number;
    title: string;
    content: string | null;
    householdId: number;
    isPinned: string;
    createdAt: Date;
}

export interface SyncOperation {
    id?: number;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: 'METER' | 'READING' | 'LIST' | 'ITEM' | 'NOTE' | 'HOUSEHOLD';
    data: any;
    timestamp: number;
    status: 'PENDING' | 'SYNCING' | 'FAILED';
}

export class MyHomeDatabase extends Dexie {
    households!: Table<OfflineHousehold>;
    meters!: Table<OfflineMeter>;
    readings!: Table<OfflineReading>;
    todoLists!: Table<OfflineTodoList>;
    todoItems!: Table<OfflineTodoItem>;
    notes!: Table<OfflineNote>;
    syncQueue!: Table<SyncOperation>;

    constructor() {
        super('MyHomeDB');
        this.version(1).stores({
            households: 'id, name, userId',
            meters: 'id, name, type, householdId',
            readings: 'id, meterId, date',
            todoLists: 'id, name, householdId',
            todoItems: 'id, listId, content',
            notes: 'id, title, householdId',
            syncQueue: '++id, type, entity, status, timestamp'
        });
    }
}

export const db = new MyHomeDatabase();
