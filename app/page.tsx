'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type SupabaseUser = {
  id: string;
  email?: string;
};

export default function Home() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // aktuális user lekérése
    supabase.auth.getUser().then(({ data }) => {
      setUser((data.user as SupabaseUser) ?? null);
      setLoading(false);
    });

    // auth state figyelése (login / logout után frissítse az UI-t)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as SupabaseUser) ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes:
          'openid email profile https://www.googleapis.com/auth/drive.readonly',
        // redirectTo opcionális – ha üresen hagyod, a Supabase Site URL-t használja
        // redirectTo: 'https://triplog-jade.vercel.app',
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Betöltés…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">TripLog 🚀</h1>

      {!user ? (
        <>
          <p className="mb-4 text-center max-w-md">
            Jelentkezz be a Google fiókoddal, hogy a saját Drive-odra menthess
            utazásokat, dokumentumokat és képeket.
          </p>
          <button
            onClick={handleLogin}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Bejelentkezés Google-lel
          </button>
        </>
      ) : (
        <>
          <p className="mb-2">Bejelentkezve mint: {user.email}</p>
          <button
            onClick={handleLogout}
            className="rounded bg-gray-200 px-4 py-2"
          >
            Kijelentkezés
          </button>
        </>
      )}
    </main>
  );
}
