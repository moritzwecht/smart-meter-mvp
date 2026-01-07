"use client";

import { useEffect, useState } from "react";
import { CloudOff, CloudSync, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";

export function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showSyncSuccess, setShowSyncSuccess] = useState(false);

    const pendingCount = useLiveQuery(() => db.syncQueue.count()) || 0;

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        if (pendingCount === 0 && isOnline) {
            // Logic to show a brief success if we just synced
        }
    }, [pendingCount, isOnline]);

    return (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/90 text-white text-xs font-bold backdrop-blur-md shadow-lg"
                    >
                        <CloudOff className="w-3.5 h-3.5" />
                        <span>Offline</span>
                    </motion.div>
                )}

                {isOnline && pendingCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-500/90 text-white text-xs font-bold backdrop-blur-md shadow-lg"
                    >
                        <CloudSync className="w-3.5 h-3.5 animate-pulse" />
                        <span>Synchronisiere {pendingCount}...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
