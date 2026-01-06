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
                    <Skeleton className="h-10 w-10" />
                </div>

                <div className="space-y-12">
                    {/* Meters Section Skeleton */}
                    <div className="space-y-4">
                        <div className="px-2">
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="card p-3 space-y-4 h-40">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-10 w-10 rounded-xl" />
                                        <Skeleton className="h-4 w-12" />
                                    </div>
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* List & Notes Section Skeleton */}
                    <div className="space-y-4">
                        <div className="px-2">
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="card p-4 space-y-4 h-48">
                                    <Skeleton className="h-6 w-1/2" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
