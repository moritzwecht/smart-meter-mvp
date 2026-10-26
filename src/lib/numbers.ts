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
        // Das zuletzt stehende Trennzeichen ist das Dezimaltrennzeichen.
        s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    } else if (lastComma >= 0) {
        s = commaCount > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
    } else if (dotCount > 1) {
        s = s.replace(/\./g, "");
    }

    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
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

export function formatCurrency(value: number): string {
    return currency.format(value);
}

/** Zahl für ein Eingabefeld (deutsches Komma, keine Tausenderpunkte). */
export function toInputValue(value: number | null | undefined): string {
    if (value === null || value === undefined) return "";
    return String(value).replace(".", ",");
}
