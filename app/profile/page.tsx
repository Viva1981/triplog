"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ProfileInfo = {
  id: string;
  email: string;
  name: string | null;
  provider: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [ownedTripsCount, setOwnedTripsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        router.push("/");
        return;
      }

      const name =
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
        null;

      const provider = (user.app_metadata as any)?.provider ?? null;

      const info: ProfileInfo = {
        id: user.id,
        email: user.email ?? "",
        name,
        provider,
      };
      setProfile(info);

      const { data: trips, error } = await supabase
        .from("trips")
        .select("id")
        .eq("owner_id", user.id);

      if (!error) {
        setOwnedTripsCount(trips?.length ?? 0);
      } else {
        setOwnedTripsCount(null);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Profil betöltése...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Nincs bejelentkezett felhasználó.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <section className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
          <h1 className="text-xl font-bold mb-4">Profil</h1>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs uppercase mb-1">
                Név (Google)
              </p>
              <p className="font-medium">
                {profile.name || "Nincs név, csak e-mailhez kötött fiók."}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-xs uppercase mb-1">E-mail</p>
              <p className="font-medium">{profile.email}</p>
            </div>

            <div>
              <p className="text-slate-500 text-xs uppercase mb-1">
                Bejelentkezés típusa
              </p>
              <p className="font-medium">
                {profile.provider === "google" || !profile.provider
                  ? "Google"
                  : profile.provider}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-slate-500 text-xs uppercase mb-1">
                Saját utazások száma
              </p>
              <p className="font-medium">
                {ownedTripsCount !== null
                  ? `${ownedTripsCount} db utazásnak vagy tulajdonosa`
                  : "Nem sikerült lekérdezni."}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Később itt fog megjelenni az is, hogy mely utazásokba hívtak meg
            útitársnak, és az útitárs jelentkezések kezelése is innen lesz
            elérhető.
          </p>
        </section>
      </div>
    </main>
  );
}
