"use client";

import { useState } from "react";
import { requestLogin } from "@/app/actions";

export function LoginForm() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await requestLogin(email);
            setSubmitted(true);
        } catch {
            setError("Etwas ist schief gelaufen. Bitte versuche es erneut.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                <h2 className="text-2xl font-bold mb-4">Check deine Emails!</h2>
                <p className="text-slate-500">
                    Wir haben dir einen Login-Link an <strong>{email}</strong> gesendet.
                </p>
                <p className="mt-4 text-sm text-slate-400">
                    (Schau in die Server-Konsole für den Link)
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium px-1">E-Mail Adresse</label>
                <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 ring-primary/20 outline-none transition-all"
                />
            </div>

            {error && <p className="text-red-500 text-sm px-1">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
                {loading ? "Wird gesendet..." : "Login Link anfordern"}
            </button>
        </form>
    );
}
