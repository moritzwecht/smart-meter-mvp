"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyLogin } from "@/app/actions";

export default function VerifyPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const token = searchParams.get("token");
        if (token) {
            verifyLogin(token)
                .then(() => {
                    setSuccess(true);
                    setTimeout(() => router.push("/"), 1500);
                })
                .catch((err) => {
                    setError(err.message || "Verifizierung fehlgeschlagen.");
                });
        } else {
            setTimeout(() => setError("Kein Token gefunden."), 0);
        }
    }, [searchParams, router]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />

            {success && (
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-green-600">Erfolgreich verifiziert!</h1>
                    <p className="text-slate-500">Du wirst gleich weitergeleitet...</p>
                </div>
            )}

            {error && (
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold text-red-600">Hoppla!</h1>
                    <p className="text-slate-500">{error}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-2 bg-slate-100 rounded-xl font-medium"
                    >
                        Zurück zum Login
                    </button>
                </div>
            )}

            {!success && !error && (
                <h1 className="text-2xl font-bold">Verifiziere Login...</h1>
            )}
        </main>
    );
}
