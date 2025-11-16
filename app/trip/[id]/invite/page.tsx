"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InvitePageProps = {
  params: {
    id: string; // trip id
  };
};

export default function TripInvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tripTitle, setTripTitle] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
        setError("Hiba történt a bejelentkezés ellenőrzésekor.");
        setLoading(false);
        return;
      }

      if (!user) {
        setError(
          "Ehhez a meghívóhoz be kell jelentkezned. Használd a jobb felső 'Bejelentkezés Google-lel' gombot."
        );
        setLoading(false);
        return;
      }

      // Ellenőrizzük, hogy a user tényleg látja-e az adott tripet (owner vagy member)
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("id, title")
        .eq("id", params.id)
        .maybeSingle();

      if (tripError || !trip) {
        console.error(tripError);
        setError(
          "Nincs jogosultságod ehhez az utazáshoz, vagy az utazás nem létezik."
        );
        setLoading(false);
        return;
      }

      setTripTitle(trip.title ?? null);

      // Meghívó link összeállítása
      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/join/${trip.id}`;
        setInviteUrl(url);
      }

      setLoading(false);
    };

    init();
  }, [params.id]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Meghívó link vágólapra másolva! 👌");
    } catch (err) {
      console.error(err);
      alert("Nem sikerült a vágólapra másolni. Másold ki kézzel.");
    }
  };

  const handleBackToTrip = () => {
    router.push(`/trip/${params.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Utazás meghívó linkje
        </h1>

        {loading && <p>Betöltés…</p>}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {tripTitle && (
              <p className="text-sm text-slate-600">
                Utazás: <span className="font-medium">{tripTitle}</span>
              </p>
            )}

            <p className="text-sm text-slate-700">
              Ezt a linket küldd el az útitársaidnak. Ha megnyitják,
              Google-lel bejelentkeznek, és automatikusan tagok lesznek ebben
              az utazásban.
            </p>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                >
                  Link másolása
                </button>
                <button
                  type="button"
                  onClick={handleBackToTrip}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Vissza az utazáshoz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
