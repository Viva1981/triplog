"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type User = {
  id: string;
  email?: string;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Betöltéskor lekérdezzük a usert
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser({ id: user.id, email: user.email ?? undefined });
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    getUser();

    // Auth változás figyelése
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "openid email profile https://www.googleapis.com/auth/drive.readonly",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          TripLog – Utazás naplózó
        </h1>

        {!user && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-600 text-center mb-2">
              Jelentkezz be Google-lel, hogy elkezdd az utazások rögzítését.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 transition"
            >
              Bejelentkezés Google-lel
            </button>
          </div>
        )}

        {user && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-slate-100 text-sm">
              <p className="font-semibold">Bejelentkezve:</p>
              <p>{user.email}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/new-trip"
                className="w-full text-center py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 transition"
              >
                Új utazás létrehozása
              </Link>

              {/* később ide jön a saját utazások listája */}
            </div>

            <button
              onClick={handleLogout}
              className="mt-2 text-sm text-slate-500 underline"
            >
              Kijelentkezés
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
