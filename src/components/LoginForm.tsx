"use client";

import { useState } from "react";
import { loginWithPassword, register } from "@/app/actions";
import { ChevronRight, Mail, Lock, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            if (isRegistering) {
                await register(email, password);
            } else {
                await loginWithPassword(email, password);
            }
            window.location.reload(); // Refresh to update session
        } catch (err: any) {
            setError(err.message || "Etwas ist schief gelaufen. Bitte versuche es erneut.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-1">
            <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
            >
                <div className="space-y-3">
                    <div className="space-y-1.5">
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
                                className="w-full bg-transparent border-b-2 border-border focus:border-primary outline-none pl-7 py-2.5 text-sm transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest opacity-40">Passwort</label>
                        <div className="relative">
                            <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-transparent border-b-2 border-border focus:border-primary outline-none pl-7 py-2.5 text-sm transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:text-primary transition-colors text-muted-foreground"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 font-bold text-[10px] italic leading-tight"
                    >
                        {error}
                    </motion.p>
                )}

                <div className="space-y-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn btn-primary py-3.5 flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <span className="opacity-50">Wird verarbeitet...</span>
                        ) : (
                            <>
                                <span>{isRegistering ? "Konto erstellen" : "Anmelden"}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError("");
                        }}
                        className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                        {isRegistering ? (
                            <>
                                <LogIn className="w-3.5 h-3.5" />
                                Bereits ein Konto? Anmelden
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-3.5 h-3.5" />
                                Neu hier? Registrieren
                            </>
                        )}
                    </button>
                </div>
            </motion.form>
        </div>
    );
}
