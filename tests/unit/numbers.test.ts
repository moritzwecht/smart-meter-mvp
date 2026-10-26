import { describe, expect, it } from "vitest";
import { parseDecimal, parseOptionalDecimal, toInputValue } from "@/lib/numbers";

describe("parseDecimal", () => {
    it.each([
        ["12345,6", 12345.6],
        ["12345.6", 12345.6],
        ["1.234,56", 1234.56],
        ["1,234.56", 1234.56],
        ["0,32 €", 0.32],
        [" 85,50 ", 85.5],
        ["1.234.567", 1234567],
        ["1,234,567", 1234567],
        [",5", 0.5],
        ["-3,5", -3.5],
        ["100", 100],
        [42, 42],
    ])("%s → %s", (input, expected) => {
        expect(parseDecimal(input)).toBe(expected);
    });

    it.each(["", "abc", "1,2,3.4.5x", "12a", "--1", null, undefined, Number.NaN, Number.POSITIVE_INFINITY])("%s → null", (input) => {
        expect(parseDecimal(input as never)).toBeNull();
    });

    it("parseOptionalDecimal unterscheidet leer und ungültig", () => {
        expect(parseOptionalDecimal("")).toBeNull();
        expect(parseOptionalDecimal("  ")).toBeNull();
        expect(parseOptionalDecimal("x")).toBeUndefined();
        expect(parseOptionalDecimal("0,95")).toBe(0.95);
    });

    it("toInputValue nutzt deutsches Komma", () => {
        expect(toInputValue(0.3245)).toBe("0,3245");
        expect(toInputValue(null)).toBe("");
    });
});
