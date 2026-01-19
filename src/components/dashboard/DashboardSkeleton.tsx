"use client";

import { Skeleton } from "@/components/ui/Skeleton";

interface DashboardSkeletonProps {
    hideHeader?: boolean;
}

export function DashboardSkeleton({ hideHeader = false }: DashboardSkeletonProps) {
    return (
        <main className={`min-h-screen ${hideHeader ? "" : "p-4 md:p-8"} max-w-7xl mx-auto space-y-8 bg-background`}>
            {/* Header Skeleton */}
            {!hideHeader && (
                <header className="flex justify-between items-center py-4 border-b border-border mb-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-10 w-24 rounded-full" />
                    </div>
                </header>
            )}

            <div className={`space-y-3 ${hideHeader ? "" : ""}`}>
                {/* Add Widget Button Skeleton */}
                <div className="flex justify-end px-2">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {/* Meter Widget Skeletons */}
                    {[1, 2, 3, 4].map((i) => (
                        <div key={`meter-${i}`} className="bg-card rounded-lg border border-border p-3 space-y-3 shadow-sm">
                            {/* Top section: Icon + Stats + Pin */}
                            <div className="flex items-center gap-3">
                                {/* Icon */}
                                <Skeleton className="w-10 h-10 rounded-xl" />

                                {/* Stats */}
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-baseline gap-1">
                                        <Skeleton className="h-6 w-16" />
                                        <Skeleton className="h-3 w-12" />
                                    </div>
                                    <Skeleton className="h-4 w-20" />
                                </div>

                                {/* Pin button */}
                                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                            </div>

                            {/* Bottom stats */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-2 border-t border-border">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        </div>
                    ))}

                    {/* List Widget Skeletons */}
                    {[1, 2].map((i) => (
                        <div key={`list-${i}`} className="bg-card rounded-lg border border-border p-3 space-y-3 shadow-sm">
                            {/* Header with icon and title */}
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                                    <Skeleton className="h-6 w-32 mt-0.5" />
                                </div>
                                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                            </div>

                            {/* List items */}
                            <div className="space-y-2">
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
                                        <Skeleton className="w-4 h-4 rounded" />
                                        <Skeleton className="h-4 flex-1" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Note Widget Skeletons */}
                    {[1, 2].map((i) => (
                        <div key={`note-${i}`} className="bg-card rounded-lg border border-border p-3 space-y-3 shadow-sm">
                            {/* Header with icon and title */}
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-5/6" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                </div>
                                <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
