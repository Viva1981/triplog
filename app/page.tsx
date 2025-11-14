"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type User = {
  id: string;
  email?: string;
};

type Trip = {
  id: string;
  title: string;
  destination: string | null;
  date_from: string | null;
  date_to: string | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  // User betöltése
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
      setLoadingUser(false);
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
        setTrips([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Saját utazások lekérése, ha van user
  useEffect(() => {
    const fetchTrips = async () => {
      if (!user) {
        setTrips([]);
        return;
      }

      setLoadingTrips(true);
      setTripsError(null);

      const { data, error } = await supabase
        .from("trips")
        .select("id, title, destination, date_from, date_to")
        .order("date_from", { ascending: true });

      if (error) {
        console.error("TRIPS FETCH ERROR:", error);
        setTripsError(error.message ?? "Nem sikerült betölteni az utazásokat.");
      } else {
        setTrips((data ?? []) as Trip[]);
      }

      setLoadingTrips(false);
    };

    fetchTrips();
  }, [user]);

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

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* FEJLÉC */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">TripLog</h1>
            <p className="text-sm text-slate-600">
              Utazások tervezése, dokumentálása, költségek egy helyen.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {!user && (
              <button
                onClick={handleLogin}
                className="py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 transition text-sm"
              >
                Bejelentkezés Google-lel
              </button>
            )}

            {user && (
              <>
                <div className="text-right text-xs text-slate-600">
                  <p className="font-semibold">Bejelentkezve:</p>
                  <p>{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/new-trip"
                    className="py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 transition text-sm"
                  >
                    Új utazás
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-slate-500 underline"
                  >
                    Kijelentkezés
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* HA NINCS USER */}
        {!user && (
          <section className="max-w-md mx-auto bg-white shadow-lg rounded-2xl p-6 mt-6">
            <h2 className="text-lg font-semibold mb-2 text-center">
              Kezdd azzal, hogy bejelentkezel
            </h2>
            <p className="text-sm text-slate-600 text-center mb-4">
              Jelentkezz be Google-lel, hogy utazásokat hozhass létre, és
              dokumentáld az élményeidet.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-2 px-4 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 transition text-sm"
            >
              Bejelentkezés Google-lel
            </button>
          </section>
        )}

        {/* HA VAN USER → SAJÁT UTAZÁSOK */}
        {user && (
          <section className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Saját utazásaid</h2>
              {/* később ide jönnek a szűrők / keresés */}
            </div>

            {lo{!loadingTrips && !tripsError && trips.length > 0 && (adingTrips && (
              <p className="text-sm text-slate-500">Utazások betöltése...</p>
            )}

            {tripsError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                {tripsError}
              </div>
            )}

                        {!loadingTrips && !tripsError && trips.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {trips.map((trip) => {
                  const from = formatDate(trip.date_from);
                  const to = formatDate(trip.date_to);

                  return (
                    <Link
                      key={trip.id}
                      href={`/trip/${trip.id}`}
                      className="bg-white rounded-2xl shadow-md p-4 flex flex-col justify-between border border-slate-100 hover:shadow-lg hover:border-[#16ba53]/30 transition"
                    >
                      <div>
                        <h3 className="text-base font-semibold mb-1">
                          {trip.title}
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          {trip.destination || "Nincs megadott desztináció"}
                        </p>
                        {(from || to) && (
                          <p className="text-xs text-slate-500">
                            {from && to
                              ? `${from} – ${to}`
                              : from
                              ? `Kezdés: ${from}`
                              : `Befejezés: ${to}`}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          Saját utazás
                        </span>
                        <span className="text-xs text-[#16ba53] font-medium underline">
                          Részletek
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
