"use client";

import { useEffect, useRef } from "react";

/**
 * Führt `fn` aus, wenn die Komponente wirklich verschwindet – nicht beim
 * simulierten Unmount/Remount von React StrictMode (`next dev`), bei dem sonst
 * z. B. eine frisch angelegte Liste sofort wieder verworfen würde.
 */
export function useFinalUnmount(fn: () => void) {
    const fnRef = useRef(fn);
    const mounted = useRef(false);
    useEffect(() => {
        fnRef.current = fn;
    });
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            setTimeout(() => {
                if (!mounted.current) fnRef.current();
            }, 0);
        };
    }, []);
}
