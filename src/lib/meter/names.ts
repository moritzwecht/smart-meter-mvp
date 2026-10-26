/*
 * Zählernamen
 * ===========
 * Jeder Zähler hat einen Namen (Spalte `name`). Ohne eigenen Namen ist es der Typ
 * („Strom“, „Gas“, „Wasser“) – so bleiben auch alle bestehenden Daten gültig.
 * Ein eigener Name (z. B. „Wärmepumpe“) unterscheidet mehrere Zähler gleichen Typs.
 */

const DEFAULT_NAMES: Record<string, string> = { ELECTRICITY: "Strom", WATER: "Wasser", GAS: "Gas" };
const STANDARD = new Set([...Object.values(DEFAULT_NAMES), "Zähler"]);

export const MAX_METER_NAME = 40;

export const defaultMeterName = (type: string) => DEFAULT_NAMES[type] ?? "Zähler";

/** Name zum Speichern: leer → Standardname des Typs. */
export const resolveMeterName = (name: string | null | undefined, type: string) => name?.trim().slice(0, MAX_METER_NAME) || defaultMeterName(type);

/** Eigener Name, falls vergeben – sonst `null`. */
export function customMeterName(meter: { name?: string | null }): string | null {
    const name = meter.name?.trim();
    return name && !STANDARD.has(name) ? name : null;
}

/** „Strom“ bzw. „Strom · Wärmepumpe“ */
export function meterTitle(meter: { name?: string | null; type: string }): string {
    const custom = customMeterName(meter);
    const type = defaultMeterName(meter.type);
    return custom ? `${type} · ${custom}` : type;
}

/** Kurz für Aufzählungen: eigener Name, sonst Typ */
export const meterShortName = (meter: { name?: string | null; type: string }) => customMeterName(meter) ?? defaultMeterName(meter.type);
