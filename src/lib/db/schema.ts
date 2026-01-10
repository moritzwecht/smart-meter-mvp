import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    password: text("password"),
    name: text("name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const households = pgTable("households", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    userId: integer("user_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const meters = pgTable("meters", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'ELECTRICITY', 'GAS', 'WATER'
    householdId: integer("household_id").references(() => households.id).notNull(),
    unit: text("unit").notNull(),
    isPinned: text("is_pinned").default("false").notNull(),
    monthlyPayment: text("monthly_payment"),
    basicFee: text("basic_fee"),
    pricePerUnit: text("price_per_unit"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readings = pgTable("readings", {
    id: serial("id").primaryKey(),
    meterId: integer("meter_id").references(() => meters.id).notNull(),
    value: text("value").notNull(),
    date: timestamp("date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const todoLists = pgTable("todo_lists", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    householdId: integer("household_id").references(() => households.id).notNull(),
    isPinned: text("is_pinned").default("false").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const todoItems = pgTable("todo_items", {
    id: serial("id").primaryKey(),
    listId: integer("list_id").references(() => todoLists.id).notNull(),
    content: text("content").notNull(),
    completed: text("completed").default("false").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content"),
    householdId: integer("household_id").references(() => households.id).notNull(),
    isPinned: text("is_pinned").default("false").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const householdUsers = pgTable("household_users", {
    id: serial("id").primaryKey(),
    householdId: integer("household_id").references(() => households.id).notNull(),
    userId: integer("user_id").references(() => users.id).notNull(),
    role: text("role").notNull().default("MEMBER"), // 'OWNER', 'MEMBER'
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
    households: many(householdUsers),
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
