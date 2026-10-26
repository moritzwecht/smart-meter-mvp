import { relations } from "drizzle-orm";
import {
    boolean,
    date,
    index,
    integer,
    numeric,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

/*
 * Datenmodell
 * ===========
 * - Nutzer & Haushalte haben fortlaufende Integer-IDs (werden nur online angelegt).
 * - Alles, was offline angelegt werden kann (Zähler, Ablesungen, Listen, Punkte,
 *   Notizen), hat eine vom Client erzeugte UUID. Dadurch sind Sync-Operationen
 *   idempotent und es gibt kein Umschreiben temporärer IDs mehr.
 * - `updatedAt` + `deletedAt` (Soft-Delete) ermöglichen Delta-Sync: Clients holen
 *   nur Änderungen seit ihrem letzten Stand – inklusive Löschungen.
 * - `legacyId` enthält die alte Integer-ID aus Version 1 (nur für die einmalige
 *   Übernahme noch nicht synchronisierter Offline-Änderungen).
 */

const timestamps = {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password"),
    name: text("name"),
    /** Wird erhöht, um alle bestehenden Sessions ungültig zu machen. */
    sessionVersion: integer("session_version").default(0).notNull(),
    /** Tag im Monat (1–28) für die Ablese-Erinnerung, `null` = aus. */
    reminderDay: integer("reminder_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const households = pgTable("households", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const householdUsers = pgTable(
    "household_users",
    {
        id: serial("id").primaryKey(),
        householdId: integer("household_id")
            .references(() => households.id, { onDelete: "cascade" })
            .notNull(),
        userId: integer("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        role: text("role").notNull().default("MEMBER"), // 'OWNER' | 'MEMBER'
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        uniqueIndex("household_users_household_user_uq").on(t.householdId, t.userId),
        index("household_users_user_id_idx").on(t.userId),
    ],
);

export const meters = pgTable(
    "meters",
    {
        id: uuid("id").primaryKey(),
        householdId: integer("household_id")
            .references(() => households.id, { onDelete: "cascade" })
            .notNull(),
        name: text("name").notNull(),
        type: text("type").notNull(), // 'ELECTRICITY' | 'GAS' | 'WATER'
        unit: text("unit").notNull(),
        isPinned: boolean("is_pinned").default(false).notNull(),
        monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2, mode: "number" }),
        basicFee: numeric("basic_fee", { precision: 12, scale: 2, mode: "number" }),
        pricePerUnit: numeric("price_per_unit", { precision: 12, scale: 6, mode: "number" }),
        /** 'kwh' = Preis pro kWh (Gas in m³ wird über Zustandszahl × Brennwert umgerechnet), sonst Zählereinheit. */
        priceUnit: text("price_unit"),
        zNumber: numeric("z_number", { precision: 10, scale: 6, mode: "number" }),
        calorificValue: numeric("calorific_value", { precision: 10, scale: 6, mode: "number" }),
        /** Beginn des Abrechnungsjahres (YYYY-MM-DD). */
        billingStart: date("billing_start", { mode: "string" }),
        legacyId: integer("legacy_id"),
        ...timestamps,
    },
    (t) => [
        index("meters_household_id_idx").on(t.householdId),
        index("meters_updated_at_idx").on(t.updatedAt),
    ],
);

export const readings = pgTable(
    "readings",
    {
        id: uuid("id").primaryKey(),
        meterId: uuid("meter_id")
            .references(() => meters.id, { onDelete: "cascade" })
            .notNull(),
        value: numeric("value", { precision: 16, scale: 4, mode: "number" }).notNull(),
        date: timestamp("date", { withTimezone: true }).notNull(),
        /** Ablesung eines neuen Zählers nach Zählerwechsel – Verbrauch wird hier nicht gegen den Vorwert gerechnet. */
        isReplacement: boolean("is_replacement").default(false).notNull(),
        /** 'app' | 'api' */
        source: text("source").default("app").notNull(),
        legacyId: integer("legacy_id"),
        ...timestamps,
    },
    (t) => [
        index("readings_meter_date_idx").on(t.meterId, t.date),
        index("readings_updated_at_idx").on(t.updatedAt),
    ],
);

export const todoLists = pgTable(
    "todo_lists",
    {
        id: uuid("id").primaryKey(),
        householdId: integer("household_id")
            .references(() => households.id, { onDelete: "cascade" })
            .notNull(),
        name: text("name").notNull(),
        isPinned: boolean("is_pinned").default(false).notNull(),
        legacyId: integer("legacy_id"),
        ...timestamps,
    },
    (t) => [
        index("todo_lists_household_id_idx").on(t.householdId),
        index("todo_lists_updated_at_idx").on(t.updatedAt),
    ],
);

export const todoItems = pgTable(
    "todo_items",
    {
        id: uuid("id").primaryKey(),
        listId: uuid("list_id")
            .references(() => todoLists.id, { onDelete: "cascade" })
            .notNull(),
        content: text("content").notNull(),
        completed: boolean("completed").default(false).notNull(),
        legacyId: integer("legacy_id"),
        ...timestamps,
    },
    (t) => [
        index("todo_items_list_id_idx").on(t.listId),
        index("todo_items_updated_at_idx").on(t.updatedAt),
    ],
);

export const notes = pgTable(
    "notes",
    {
        id: uuid("id").primaryKey(),
        householdId: integer("household_id")
            .references(() => households.id, { onDelete: "cascade" })
            .notNull(),
        title: text("title").notNull(),
        content: text("content"),
        isPinned: boolean("is_pinned").default(false).notNull(),
        legacyId: integer("legacy_id"),
        ...timestamps,
    },
    (t) => [
        index("notes_household_id_idx").on(t.householdId),
        index("notes_updated_at_idx").on(t.updatedAt),
    ],
);

/** Einmal-Tokens für Einladungen und Passwort-Reset. Gespeichert wird nur der SHA-256-Hash. */
export const authTokens = pgTable(
    "auth_tokens",
    {
        id: serial("id").primaryKey(),
        purpose: text("purpose").notNull(), // 'INVITE' | 'RESET'
        tokenHash: text("token_hash").notNull().unique(),
        email: text("email").notNull(),
        householdId: integer("household_id").references(() => households.id, { onDelete: "cascade" }),
        createdBy: integer("created_by").references(() => users.id, { onDelete: "cascade" }),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        usedAt: timestamp("used_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [index("auth_tokens_email_idx").on(t.email), index("auth_tokens_household_idx").on(t.householdId)],
);

/** Fehlgeschlagene Login-/Reset-Versuche für ein einfaches Rate-Limit. */
export const authAttempts = pgTable(
    "auth_attempts",
    {
        id: serial("id").primaryKey(),
        key: text("key").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [index("auth_attempts_key_created_idx").on(t.key, t.createdAt)],
);

/** Persönliche API-Tokens (z. B. für Home Assistant). Gespeichert wird nur der Hash. */
export const apiTokens = pgTable(
    "api_tokens",
    {
        id: serial("id").primaryKey(),
        userId: integer("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        name: text("name").notNull(),
        tokenHash: text("token_hash").notNull().unique(),
        tokenPrefix: text("token_prefix").notNull(),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [index("api_tokens_user_id_idx").on(t.userId)],
);

export const pushSubscriptions = pgTable(
    "push_subscriptions",
    {
        id: serial("id").primaryKey(),
        userId: integer("user_id")
            .references(() => users.id, { onDelete: "cascade" })
            .notNull(),
        endpoint: text("endpoint").notNull().unique(),
        p256dh: text("p256dh").notNull(),
        auth: text("auth").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [index("push_subscriptions_user_id_idx").on(t.userId)],
);

// Relations ------------------------------------------------------------------

export const userRelations = relations(users, ({ many }) => ({
    memberships: many(householdUsers),
}));

export const householdRelations = relations(households, ({ many }) => ({
    members: many(householdUsers),
    meters: many(meters),
    todoLists: many(todoLists),
    notes: many(notes),
}));

export const householdUserRelations = relations(householdUsers, ({ one }) => ({
    household: one(households, { fields: [householdUsers.householdId], references: [households.id] }),
    user: one(users, { fields: [householdUsers.userId], references: [users.id] }),
}));

export const meterRelations = relations(meters, ({ one, many }) => ({
    household: one(households, { fields: [meters.householdId], references: [households.id] }),
    readings: many(readings),
}));

export const readingRelations = relations(readings, ({ one }) => ({
    meter: one(meters, { fields: [readings.meterId], references: [meters.id] }),
}));

export const todoListRelations = relations(todoLists, ({ one, many }) => ({
    household: one(households, { fields: [todoLists.householdId], references: [households.id] }),
    items: many(todoItems),
}));

export const todoItemRelations = relations(todoItems, ({ one }) => ({
    list: one(todoLists, { fields: [todoItems.listId], references: [todoLists.id] }),
}));

export const noteRelations = relations(notes, ({ one }) => ({
    household: one(households, { fields: [notes.householdId], references: [households.id] }),
}));
