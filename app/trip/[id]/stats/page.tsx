"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip } from "../../../../lib/trip/types";
import TripStatsView from "./TripStatsView";

type User = {
  id: string;
  email?: string;
  displayName?: string;
};

export default function TripStatsPage() {
  const params = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User betöltése
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

      const metadata = (user.user_metadata || {}) as any;
      const displayName =
        metadata.full_name ||
        metadata.name ||
        metadata.preferred_username ||
        undefined;

      setUser({
        id: user.id,
        email: user.email ?? undefined,
        displayName,
      });
      setLoadingUser(false);
    };

    fetchUser();
  }, [router]);

  // Trip betöltése
  useEffect(() => {
    const fetchTrip = async () => {
      const tripId = params?.id;
      if (!tripId || Array.isArray(tripId)) {
        setError("Érvénytelen utazás azonosító.");
        setLoadingTrip(false);
        return;
      }

      setLoadingTrip(true);
      setError(null);

      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
        .eq("id", tripId)
        .single();

      if (error || !data) {
        console.error("TRIP FETCH ERROR (stats):", error);
        setError(
          error?.message ??
            "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."
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

  if (loadingUser || loadingTrip) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p>Statisztikák betöltése...</p>
      </main>
    );
  }

  if (error || !trip || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">
            Hiba a statisztika betöltése közben
          </h1>
          <p className="text-sm text-red-600 mb-4">
            {error ??
              "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."}
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Vissza link */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/trip/${trip.id}`}
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <span className="mr-1">←</span> Vissza az utazáshoz
          </Link>
        </div>

        {/* Fejléc */}
        <section className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100 mb-4">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mb-1">
            Költségek statisztika
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mb-2">
            Egyszerű összefoglaló arról, hogy mire mennyi ment el az utazáson –
            minden ehhez az utazáshoz rögzített költségre, vagy egy
            kiválasztott napra bontva.
          </p>
          <p className="text-xs md:text-sm text-slate-500">
            <span className="font-medium text-slate-700">{trip.title}</span>{" "}
            {trip.destination && (
              <>
                • <span>{trip.destination}</span>
              </>
            )}{" "}
            {trip.date_from && trip.date_to && (
              <>
                •{" "}
                <span>
                  {trip.date_from} – {trip.date_to}
                </span>
              </>
            )}
          </p>
        </section>

        {/* Statisztika nézet */}
        <TripStatsView
          trip={trip}
          currentUserId={user.id}
          currentUserDisplayName={user.displayName ?? user.email ?? null}
        />
      </div>
    </main>
  );
}
