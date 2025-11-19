"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import type { Trip } from "../../../lib/trip/types";

type User = {
  id: string;
  email?: string;
  displayName?: string;
};

export default function JoinTripPage() {
  const params = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // user betöltés
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

  // trip betöltés
  useEffect(() => {
    const fetchTrip = async () => {
      const tripId = params?.tripId;
      if (!tripId || Array.isArray(tripId)) {
        setError("Érvénytelen meghívó link.");
        setLoadingTrip(false);
        return;
      }

      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
        .eq("id", tripId)
        .single();

      if (error || !data) {
        console.error("JOIN TRIP FETCH ERROR:", error);
        setError(
          error?.message ??
            "Nem található ez az utazás, vagy nincs jogosultságod a csatlakozáshoz."
        );
        setTrip(null);
      } else {
        setTrip(data as Trip);
      }

      setLoadingTrip(false);
    };

    if (!loadingUser) {
      fetchTrip();
    }
  }, [params, loadingUser]);

  const handleJoin = async () => {
    if (!user || !trip) return;

    setJoining(true);
    setError(null);
    setStatusMessage(null);

    try {
      // megnézzük, nem tag-e már
      const { data: existing, error: existingError } = await supabase
        .from("trip_members")
        .select("id, status")
        .eq("trip_id", trip.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) {
        console.error("JOIN CHECK ERROR:", existingError);
      }

      if (existing) {
        setStatusMessage(
          existing.status === "accepted"
            ? "Már tagja vagy ennek az utazásnak, átirányítunk az oldalára..."
            : "Már kérted a csatlakozást ehhez az utazáshoz."
        );
        setTimeout(() => router.push(`/trip/${trip.id}`), 1500);
        setJoining(false);
        return;
      }

      const displayName =
        user.displayName || user.email || "Ismeretlen útitárs";

      const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: trip.id,
        user_id: user.id,
        role: "member",
        status: "accepted",
        display_name: displayName,
        email: user.email ?? null,
      });

      if (insertError) {
        console.error("JOIN INSERT ERROR:", insertError);
        throw new Error(
          insertError.message ?? "Nem sikerült csatlakozni az utazáshoz."
        );
      }

      setStatusMessage("Sikeresen csatlakoztál, átirányítunk az utazás oldalára...");
      setTimeout(() => router.push(`/trip/${trip.id}`), 1500);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Ismeretlen hiba történt csatlakozás közben.");
    } finally {
      setJoining(false);
    }
  };

  if (loadingUser || loadingTrip) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>Utazás betöltése...</p>
      </main>
    );
  }

  if (error || !trip || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">
            Hiba a csatlakozás közben
          </h1>
          <p className="text-sm text-red-600 mb-4">
            {error ??
              "Nem található ez az utazás, vagy nincs jogosultságod a csatlakozáshoz."}
          </p>
          <Link href="/" className="text-sm text-[#16ba53] underline">
            Vissza a főoldalra
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <section className="bg-white rounded-2xl shadow-md p-4 md:p-6 border border-slate-100 text-center">
          <h1 className="text-xl font-semibold mb-2">
            Csatlakozás az utazáshoz
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            {trip.title}
            {trip.destination ? ` – ${trip.destination}` : ""}
          </p>

          <p className="text-xs text-slate-500 mb-4">
            Ha csatlakozol, látni fogod az utazás költségeit, fotóit,
            dokumentumait. A többiek számára a Google neved vagy az email
            címed &quot;útitársként&quot; jelenik meg.
          </p>

          {statusMessage && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
              {statusMessage}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-[#16ba53] text-white text-sm font-medium hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {joining ? "Csatlakozás..." : "Csatlakozom ehhez az utazáshoz"}
          </button>
        </section>
      </div>
    </main>
  );
}
