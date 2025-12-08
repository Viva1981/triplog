"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import type { Trip } from "../../lib/trip/types";

// Drive setup
import { setupDriveForNewTrip } from "@/lib/trip/driveSetup";

// Google Places városválasztó
import DestinationAutocomplete from "./DestinationAutocomplete";

type User = {
  id: string;
  email?: string;
  displayName?: string;
};

export default function NewTripPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------
  // BEJELENTKEZETT USER LEKÉRÉSE
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoadingUser(false);
        router.push("/");
        return;
      }

      const meta = (user.user_metadata || {}) as any;
      const displayName =
        meta.full_name || meta.name || meta.preferred_username || undefined;

      setUser({
        id: user.id,
        email: user.email ?? undefined,
        displayName,
      });

      setLoadingUser(false);
    };

    fetchUser();
  }, [router]);

  // ---------------------------------------------------------
  // ÚJ UTAZÁS LÉTREHOZÁSA
  // ---------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setError("Az utazás címe kötelező.");
      return;
    }

    if (!dateFrom) {
      setError("A kezdő dátum megadása kötelező.");
      return;
    }

    if (dateTo && dateFrom && new Date(dateTo) < new Date(dateFrom)) {
      setError("A befejező dátum nem lehet korábbi, mint a kezdő dátum.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // 1) Trip INSERT
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          destination: destination.trim() || null,
          date_from: dateFrom, // itt már biztosan van érték
          date_to: dateTo || null,
          notes: null,
        })
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
        .single();

      if (tripError || !tripData) {
        console.error("TRIP INSERT ERROR:", tripError);
        throw new Error("Nem sikerült létrehozni az utazást.");
      }

      const trip = tripData as Trip;

      // 2) Owner felvétele trip_members-be
      const displayName = user.displayName || user.email || "Ismeretlen utazó";

      const { error: memberError } = await supabase.from("trip_members").insert({
        trip_id: trip.id,
        user_id: user.id,
        role: "owner",
        status: "accepted",
        display_name: displayName,
        email: user.email ?? null,
      });

      if (memberError) {
        console.error("TRIP_MEMBER OWNER INSERT ERROR:", memberError);
      }

      // 3) Drive mappa + welcome TXT létrehozása
      try {
        await setupDriveForNewTrip({
          tripId: trip.id,
          title: trip.title,
          dateFrom: trip.date_from || "",
          dateTo: trip.date_to || "",
        });
      } catch (driveErr) {
        console.error("Drive setup error:", driveErr);
        // NEM dobunk hibát — az utazás létrejött és használható
      }

      // 4) Navigáció az utazás oldalára
      router.push(`/trip/${trip.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Ismeretlen hiba történt.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>Betöltés.</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <span className="mr-1">←</span> Vissza a főoldalra
          </Link>
        </div>

        <section className="bg-white rounded-2xl shadow-md p-4 md:p-6 border border-slate-100">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mb-3">
            Új utazás létrehozása
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Utazás címe *
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                placeholder="Pl.: Tavaszi Alpok"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Desztináció
              </label>
              <DestinationAutocomplete
                value={destination}
                onChange={setDestination}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Kezdő dátum *
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Befejező dátum
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-[#16ba53] text-white text-sm font-medium hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? "Mentés..." : "Utazás létrehozása"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
