export type MeterType = "ELECTRICITY" | "GAS" | "WATER";

export interface Reading {
    value: number;
    date: Date;
}

export interface CalculationResult {
    dailyAvg: number;
    monthlyPrognosis: number;
    yearlyPrognosis: number;
    costPrognosisMonthly?: number;
    status: "GREEN" | "YELLOW" | "RED";
}

export function calculateStats(
    meterType: MeterType,
    readings: Reading[],
    monthlyPayment?: number | null,
    unitPrice?: number | null
): CalculationResult | null {
    if (readings.length < 2) return null;

    // Sort readings by date
    const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalDifference = last.value - first.value;
    const timeDifferenceDays = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);

    if (timeDifferenceDays === 0) return null;

    const dailyAvg = totalDifference / timeDifferenceDays;
    const monthlyPrognosis = dailyAvg * 30;
    const yearlyPrognosis = dailyAvg * 365;

    let costPrognosisMonthly: number | undefined;
    if (unitPrice) {
        costPrognosisMonthly = monthlyPrognosis * unitPrice;
    }

    // Determine status
    let status: "GREEN" | "YELLOW" | "RED" = "GREEN";

    if (monthlyPayment && costPrognosisMonthly) {
        const ratio = costPrognosisMonthly / monthlyPayment;
        if (ratio > 1.2) status = "RED";
        else if (ratio > 1.0) status = "YELLOW";
    } else {
        // Default heuristics based on average usage if no price is set
        // For MVP, we'll just use a simple ratio if we have at least 3 readings to see a trend, 
        // or just return GREEN for now if no reference is available.
        // Let's compare the last interval with the overall average.
        if (readings.length >= 3) {
            const secondToLast = sorted[sorted.length - 2];
            const lastIntervalDays = (last.date.getTime() - secondToLast.date.getTime()) / (1000 * 60 * 60 * 24);
            const lastIntervalAvg = (last.value - secondToLast.value) / lastIntervalDays;

            const trendRatio = lastIntervalAvg / dailyAvg;
            if (trendRatio > 1.3) status = "RED";
            else if (trendRatio > 1.1) status = "YELLOW";
        }
    }

    return {
        dailyAvg,
        monthlyPrognosis,
        yearlyPrognosis,
        costPrognosisMonthly,
        status
    };
}
