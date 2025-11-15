"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type User = {
  id: string;
  email?: string;
};

export default function NewTripPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // User betöltése, ha nincs user, vissza a főoldalra
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoadingUser(false);
        router.push("/"); // nincs login → vissza a főoldalra
        return;
      }

      setUser({ id: user.id, email: user.email ?? undefined });
      setLoadingUser(false);
    };

    fetchUser();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!user) {
      setError("Be kell jelentkezned az utazás létrehozásához.");
      return;
    }

    if (!title.trim()) {
      setError("Az utazás címe kötelező.");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Trip beszúrás
            const { data: tripInsertData, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          destination: destination.trim() || null,
          destination_place_id: null, // később: Google Places ID
          date_from: dateFrom || null,
          date_to: dateTo || null,
        })
        .select("*")
        .single();

      if (tripError || !tripInsertData) {
        console.error("TRIP INSERT ERROR:", tripError);
        setError(
          tripError?.message ??
            "Ismeretlen hiba történt az utazás létrehozásakor."
        );
        setSubmitting(false);
        return;
      }


      const tripId = tripInsertData.id as string;

      // 2) A létrehozó felvitele trip_members táblába ownerként
      const { error: memberError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: user.id,
        role: "owner",
        status: "accepted",
      });

            if (memberError) {
        console.error(memberError);
        throw new Error(
          "Az utazás létrejött, de a tagság mentése közben hiba történt."
        );
      }

      // siker – irány az új utazás oldala
      router.push(`/trip/${tripId}`);
      return;

      // ✳️ KÉSŐBB: ha meglesz a /trip/[id] oldal, ide jöhet a redirect:
      // router.push(`/trip/${tripId}`);
    } catch (err: any) {
      console.error("HANDLE SUBMIT ERROR:", err);
      setError(err?.message ?? "Ismeretlen hiba történt.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  if (!user) {
    // rövid időre látható lehet, amíg a redirect lefut
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Átirányítás a bejelentkezéshez...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Új utazás létrehozása
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Utazás címe *
            </label>
            <input
              type="text"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pl.: Nyári nyaralás Horvátországban"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Desztináció
            </label>
            <input
              type="text"
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Pl.: Zadar, Horvátország"
            />
            <p className="text-xs text-slate-500 mt-1">
              Később ezt Google Places autocomplettel okosítjuk.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Kezdő dátum
              </label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Befejező dátum
              </label>
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition"
          >
            {submitting ? "Létrehozás..." : "Utazás létrehozása"}
          </button>
        </form>

        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-slate-500 underline"
        >
          Vissza a főoldalra
        </button>
      </div>
    </main>
  );
}
