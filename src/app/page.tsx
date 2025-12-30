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
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm border border-black p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">ArmbrustTracker</h1>
            <p className="text-sm border-t border-black/10 pt-1">WIREFRAME v0.1</p>
          </div>
          <LoginForm />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto space-y-12">
      <header className="flex justify-between items-end border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">ArmbrustTracker</h1>
          <p className="font-mono text-sm opacity-50">USER: {session.email}</p>
        </div>
        <button
          onClick={() => logoutAction()}
          className="px-4 py-2 border border-black text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          Logout
        </button>
      </header>

      <div className="border-4 border-black p-12 flex flex-col items-center justify-center text-center gap-6">
        <p className="font-bold uppercase tracking-widest opacity-30">No Data Available</p>
        <button className="px-8 py-4 bg-black text-white font-bold uppercase tracking-widest hover:opacity-80">
          Add Meter (+)
        </button>
      </div>
    </main>
  );
}
