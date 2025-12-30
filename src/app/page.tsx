"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { logout as logoutAction } from "./actions";

interface Session {
  email: string;
  expires: string;
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We can't use getSession directly here easily because of cookies()
    // Let's create a small action for this or just check if the session cookie exists via fetching a mini-api
    // For simplicity, let's assume we need a check.
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setSession(data.session))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">ArmbrustTracker</h1>
            <p className="text-slate-500">Willkommen zurück!</p>
          </div>
          <LoginForm />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 p-6 md:p-24 flex flex-col gap-8">
      <header className="flex justify-between items-center w-full max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-500">Eingeloggt als {session.email}</p>
        </div>
        <button
          onClick={() => logoutAction()}
          className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-950 transition-colors"
        >
          Abmelden
        </button>
      </header>

      <div className="w-full max-w-4xl mx-auto border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center gap-4">
        <p className="text-slate-400">Hier werden bald deine Zählerstände erscheinen.</p>
        <button className="px-6 py-3 bg-primary text-white rounded-2xl font-bold">
          Zähler hinzufügen
        </button>
      </div>
    </main>
  );
}
