"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyLogin } from "@/app/actions";

function VerifyContent() {
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
        <div className="p-8 border-2 border-black space-y-6">
            <div className="font-mono text-xs uppercase tracking-widest opacity-50">Auth Verification</div>

            {success && (
                <div className="space-y-4">
                    <h1 className="text-xl font-black uppercase text-green-600">Verified.</h1>
                    <p className="font-mono text-sm italic">Redirecting to root...</p>
                </div>
            )}

            {error && (
                <div className="space-y-6">
                    <h1 className="text-xl font-black uppercase text-red-600">Error.</h1>
                    <p className="font-mono text-sm border-l-4 border-red-600 pl-4 py-2 bg-red-50">{error}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-2 border border-black font-bold uppercase text-xs tracking-widest hover:bg-black hover:text-white"
                    >
                        Go to Login
                    </button>
                </div>
            )}

            {!success && !error && (
                <div className="flex items-center gap-4">
                    <div className="w-4 h-4 bg-black animate-pulse" />
                    <h1 className="text-lg font-bold uppercase tracking-widest">Processing...</h1>
                </div>
            )}
        </div>
    );
}

export default function VerifyPage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6">
            <Suspense fallback={<div>Laden...</div>}>
                <VerifyContent />
            </Suspense>
        </main>
    );
}
