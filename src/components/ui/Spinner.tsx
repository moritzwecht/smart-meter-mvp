"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps extends React.HTMLAttributes<SVGElement> {
    size?: number;
}

export function Spinner({ className, size = 16, ...props }: SpinnerProps) {
    return (
        <Loader2
            className={cn("animate-spin text-muted-foreground", className)}
            size={size}
            {...props}
        />
    );
}
