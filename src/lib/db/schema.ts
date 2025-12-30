import { pgTable, text, serial, timestamp, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const meterTypeEnum = pgEnum("meter_type", ["ELECTRICITY", "GAS", "WATER"]);

export const meters = pgTable("meters", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: meterTypeEnum("type").notNull(),
    unit: text("unit").notNull(), // e.g., kWh, m³
    unitPrice: doublePrecision("unit_price"), // Price per unit
    monthlyPayment: doublePrecision("monthly_payment"), // Euro per month
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const readings = pgTable("readings", {
    id: serial("id").primaryKey(),
    meterId: serial("meter_id").references(() => meters.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    date: timestamp("date").defaultNow().notNull(),
});

export const metersRelations = relations(meters, ({ many }) => ({
    readings: many(readings),
}));

export const readingsRelations = relations(readings, ({ one }) => ({
    meter: one(meters, {
        fields: [readings.meterId],
        references: [meters.id],
    }),
}));
