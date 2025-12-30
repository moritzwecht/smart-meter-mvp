import { Zap, Flame, Droplets, TrendingUp, AlertTriangle, CheckCircle, Clock, Trash2 } from "lucide-react";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import { CalculationResult, MeterType } from "@/lib/calculations";

interface MeterCardProps {
    id: number;
    name: string;
    type: MeterType;
    unit: string;
    lastReading?: number;
    lastReadingDate?: Date;
    stats: CalculationResult | null;
    onAddReading: () => void;
    onDelete?: () => void;
}

export function MeterCard({
    name,
    type,
    unit,
    lastReading,
    lastReadingDate,
    stats,
    onAddReading,
    onDelete,
}: MeterCardProps) {
    const icons = {
        ELECTRICITY: <Zap className="w-6 h-6 text-yellow-500" />,
        GAS: <Flame className="w-6 h-6 text-orange-500" />,
        WATER: <Droplets className="w-6 h-6 text-blue-500" />,
    };

    const statusColors = {
        GREEN: "bg-status-green/10 border-status-green/20 text-status-green",
        YELLOW: "bg-status-yellow/10 border-status-yellow/20 text-status-yellow",
        RED: "bg-status-red/10 border-status-red/20 text-status-red",
    };

    const statusIcons = {
        GREEN: <CheckCircle className="w-4 h-4" />,
        YELLOW: <AlertTriangle className="w-4 h-4" />,
        RED: <AlertTriangle className="w-4 h-4" />,
    };

    return (
        <div className="glass rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            {/* Type Badge */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl">
                        {icons[type]}
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">{name}</h3>
                        <p className="text-xs text-foreground/50 uppercase tracking-wider">{type}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {stats && (
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border animate-pulse-slow",
                            statusColors[stats.status]
                        )}>
                            {statusIcons[stats.status]}
                            {stats.status}
                        </div>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Zähler wirklich löschen?")) onDelete();
                            }}
                            className="p-2 hover:bg-status-red/10 hover:text-status-red rounded-xl transition-all text-foreground/20"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Reading */}
            <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground/40 font-medium">Letzter Stand</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                        {lastReading ? formatNumber(lastReading) : "---"}
                    </span>
                    <span className="text-lg text-foreground/40 font-medium">{unit}</span>
                </div>
                {lastReadingDate && (
                    <p className="text-xs text-foreground/40 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {lastReadingDate.toLocaleDateString("de-DE")}
                    </p>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                    <p className="text-[10px] text-foreground/40 uppercase font-bold tracking-widest leading-none">Prognose / Jahr</p>
                    <p className="font-semibold">
                        {stats ? formatNumber(stats.yearlyPrognosis, 0) : "---"}
                        <span className="ml-1 text-[10px] text-foreground/30">{unit}</span>
                    </p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                    <p className="text-[10px] text-foreground/40 uppercase font-bold tracking-widest leading-none">Durchschnitt / Tag</p>
                    <p className="font-semibold text-primary">
                        {stats ? formatNumber(stats.dailyAvg) : "---"}
                        <span className="ml-1 text-[10px] text-foreground/30">{unit}</span>
                    </p>
                </div>
            </div>

            {/* Action */}
            <button
                onClick={onAddReading}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 mt-2"
            >
                <TrendingUp className="w-4 h-4" />
                Stand eintragen
            </button>

            {/* Decorative effect */}
            <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500" />
        </div>
    );
}
