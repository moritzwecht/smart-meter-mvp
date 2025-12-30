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
            <div className="p-6 border-4 border-black bg-white space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-green-500" />
                    <h2 className="text-xl font-black uppercase tracking-tighter">Check deine E-Mails</h2>
                </div>
                <p className="text-sm font-bold">
                    Ein Login-Link wurde an <span className="underline">{email}</span> gesendet.
                </p>
                <p style={{ fontSize: '12px', opacity: 0.5 }}>
                    Falls keine E-Mail ankommt, schau bitte auch im Spam-Ordner nach.
                </p>
                <button
                    onClick={() => setSubmitted(false)}
                    className="text-[10px] font-black uppercase underline hover:no-underline"
                >
                    Zurück zum Login
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-bold uppercase tracking-tight">E-Mail</label>
                <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-Mail Adresse"
                    className="px-3 py-2 border border-black bg-transparent outline-none focus:bg-slate-100"
                />
            </div>

            {error && <p className="text-red-500 font-bold text-sm italic">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="px-4 py-3 border border-black bg-black text-white font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
                {loading ? "Wird gesendet..." : "Login anfordern"}
            </button>
        </form>
    );
}
