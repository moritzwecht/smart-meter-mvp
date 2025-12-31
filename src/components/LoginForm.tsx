"use client";

import { useState } from "react";
import { requestLogin } from "@/app/actions";
import { ChevronRight, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

    return (
        <div className="p-2">
            <AnimatePresence mode="wait">
                {submitted ? (
                    <motion.div
                        key="submitted"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6 text-center py-4"
                    >
                        <div className="w-16 h-16 bg-accent rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-black tracking-tight">Check deine E-Mails</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Ein Login-Link wurde an <br />
                                <span className="font-bold text-foreground underline decoration-border underline-offset-4">{email}</span> <br />
                                gesendet.
                            </p>
                        </div>
                        <div className="pt-4">
                            <button
                                onClick={() => setSubmitted(false)}
                                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Zurück zum Login
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.form
                        key="form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest opacity-40">E-Mail Adresse</label>
                            <div className="relative">
                                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@beispiel.de"
                                    className="w-full bg-transparent border-b-2 border-border focus:border-primary outline-none pl-7 py-3 text-sm transition-colors"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-500 font-bold text-xs italic"
                            >
                                {error}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn btn-primary py-4 mt-4 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <span className="opacity-50">Wird gesendet...</span>
                            ) : (
                                <>
                                    <span>Login anfordern</span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}
