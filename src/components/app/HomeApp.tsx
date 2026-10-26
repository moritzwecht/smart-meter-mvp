"use client";

import { useEffect } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useSession } from "@/lib/offline/hooks";
import { bootstrapSession } from "@/lib/offline/session";

export function HomeApp() {
    const session = useSession();

    useEffect(() => {
        void bootstrapSession();
    }, []);

    if (session.status === "loading") return <DashboardSkeleton />;
    if (session.status === "anonymous") return <AuthScreen expired={session.reason === "expired"} />;
    return <Dashboard user={session.user} />;
}
