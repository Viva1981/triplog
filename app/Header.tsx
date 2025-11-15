"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type UserInfo = {
  id: string;
  email?: string;
  name?: string | null;
};

export function Header() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const name =
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
        null;

      setUser({
        id: user.id,
        email: user.email ?? undefined,
        name,
      });
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes:
          scopes:
  "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navClass = (href: string) =>
    `px-4 py-1.5 rounded-full text-sm font-medium transition ${
      pathname === href
        ? "bg-[#16ba53] text-white shadow"
        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#16ba53] text-white flex items-center justify-center text-xs font-bold shadow-sm">
            TL
          </div>
          <span className="font-semibold text-sm text-slate-800">TripLog</span>
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <Link href="/new-trip" className={navClass("/new-trip")}>
                Új utazás
              </Link>
              <Link href="/profile" className={navClass("/profile")}>
                Profil
              </Link>
            </>
          )}

          {!loading && !user && (
            <button
              onClick={handleLogin}
              className="px-4 py-1.5 rounded-full bg-[#16ba53] text-white font-medium text-sm hover:opacity-90 shadow"
            >
              Bejelentkezés Google-lel
            </button>
          )}

          {!loading && user && (
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-sm"
            >
              Kijelentkezés
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
