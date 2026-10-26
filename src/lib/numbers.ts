/**
 * Zahlen-Hilfen, die Client und Server gemeinsam nutzen.
 *
 * Eingaben kommen aus deutschen Formularen ("1.234,56", "0,32 €") genauso wie aus
 * APIs ("1234.56"). `parseDecimal` liefert `null`, wenn die Eingabe keine Zahl ist –
 * statt stillschweigend falsche Werte (z. B. `parseFloat("1.234,5") === 1.234`).
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
    if (input === null || input === undefined) return null;
    if (typeof input === "number") return Number.isFinite(input) ? input : null;

    let s = input.replace(/[\s €]/g, "");
    if (!s) return null;

    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const commaCount = s.split(",").length - 1;
    const dotCount = s.split(".").length - 1;

    if (lastComma >= 0 && lastDot >= 0) {
        // Das zuletzt stehende Trennzeichen ist das Dezimaltrennzeichen, das andere trennt Tausender.
        const [decimal, thousands] = lastComma > lastDot ? [",", "."] : [".", ","];
        const at = s.lastIndexOf(decimal);
        const intPart = s.slice(0, at);
        if (s.split(decimal).length > 2 || !isGrouped(intPart, thousands)) return null;
        s = `${intPart.split(thousands).join("")}.${s.slice(at + 1)}`;
    } else if (commaCount > 1 || dotCount > 1) {
        // Mehrere gleiche Trennzeichen: nur als Tausendertrennung in Dreiergruppen gültig ("1.234.567")
        const sep = commaCount > 1 ? "," : ".";
        if (!isGrouped(s, sep)) return null;
        s = s.split(sep).join("");
    } else if (lastComma >= 0) {
        s = s.replace(",", ".");
    }

    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/** "1.234.567" bzw. "-12,345" – Tausendertrennung nur in Dreiergruppen. Ohne Trennzeichen immer gültig. */
function isGrouped(intPart: string, sep: string): boolean {
    if (!intPart.includes(sep)) return true;
    const e = sep === "." ? "\\." : ",";
    return new RegExp(`^-?\\d{1,3}(${e}\\d{3})+$`).test(intPart);
}

/** Zählerstände speichert die Datenbank mit 4 Nachkommastellen – überall gleich runden. */
export function roundReading(value: number): number {
    return Math.round(value * 1e4) / 1e4;
}

/** Wie `parseDecimal`, aber für optionale Formularfelder: leer → `null`, ungültig → `undefined`. */
export function parseOptionalDecimal(input: string | null | undefined): number | null | undefined {
    if (input === null || input === undefined || input.trim() === "") return null;
    const n = parseDecimal(input);
    return n === null ? undefined : n;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, decimals = 2, minDecimals = decimals): string {
    const key = `${decimals}:${minDecimals}`;
    let f = formatters.get(key);
    if (!f) {
        f = new Intl.NumberFormat("de-DE", { minimumFractionDigits: minDecimals, maximumFractionDigits: decimals });
        formatters.set(key, f);
    }
    return f.format(value);
}

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const wholeCurrency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** Euro mit Cent – oder ganze Euro (`whole`) für Schätzungen, die nicht centgenau sein können. */
export function formatCurrency(value: number, options: { whole?: boolean } = {}): string {
    return (options.whole ? wholeCurrency : currency).format(value);
}

/** Zahl für ein Eingabefeld (deutsches Komma, keine Tausenderpunkte). */
export function toInputValue(value: number | null | undefined): string {
    if (value === null || value === undefined) return "";
    return String(value).replace(".", ",");
}
