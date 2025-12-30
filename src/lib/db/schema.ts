import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

// We will define the new schema for email authentication and smart meters soon.
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
