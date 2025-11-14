"use client";

import { useEffect, useState, useMemo } from "react";
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

type TripFilterType = "all" | "own" | "shared";

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
    return dateStr ?? "";
  }
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);

  // KERESÉS + SZŰRŐK
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<TripFilterType>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

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

  // Saját utazások lekérése
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

  // SZŰRT LISTA KISZÁMOLÁSA
  const filteredTrips = useMemo(() => {
    let res = [...trips];

    // Szűrés keresőkifejezésre (cím + desztináció)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      res = res.filter((trip) => {
        const title = trip.title?.toLowerCase() ?? "";
        const dest = trip.destination?.toLowerCase() ?? "";
        return title.includes(q) || dest.includes(q);
      });
    }

    // Dátum szűrés (átfedés logika: ha a trip bármely része belelóg az intervallumba)
    const from = filterFrom ? new Date(filterFrom) : null;
    const to = filterTo ? new Date(filterTo) : null;

    if (from || to) {
      res = res.filter((trip) => {
        const tripFrom = trip.date_from ? new Date(trip.date_from) : null;
        const tripTo = trip.date_to ? new Date(trip.date_to) : null;

        // ha a tripnek sincs dátuma → ne jelenjen meg szűrt módban
        if (!tripFrom && !tripTo) return false;

        const start = tripFrom ?? tripTo!;
        const end = tripTo ?? tripFrom!;

        if (from && end < from) return false;
        if (to && start > to) return false;

        return true;
      });
    }

    // Trip típusa - jelenleg RLS miatt valójában csak sajátakat látunk,
    // de az UI készen áll a későbbi "közös utazások" logikához.
    if (filterType === "own") {
      // később itt lehetne owner filter, ha lenne join
      // most minden trip saját (owner), így nincs különbség
      res = res;
    } else if (filterType === "shared") {
      // később: csak azok, ahol útitárs, de nem owner
      // most még üres, ezért ideiglenesen nincs külön logika
      res = res;
    }

    return res;
  }, [trips, searchTerm, filterFrom, filterTo, filterType]);

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

        {/* HA VAN USER → KERESŐ + LISTA */}
        {user && (
          <section className="mt-4">
            {/* Kereső + szűrő sor */}
            <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100 mb-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1">
                    Keresés (cím / desztináció)
                  </label>
                  <input
                    type="text"
                    placeholder="Pl.: Horvátország, Zadar, Síelés..."
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Típus
                  </label>
                  <div className="flex rounded-xl border bg-slate-50 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      className={`px-3 py-1.5 flex-1 ${
                        filterType === "all"
                          ? "bg-[#16ba53] text-white"
                          : "text-slate-600"
                      }`}
                    >
                      Összes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("own")}
                      className={`px-3 py-1.5 flex-1 ${
                        filterType === "own"
                          ? "bg-[#16ba53] text-white"
                          : "text-slate-600"
                      }`}
                    >
                      Saját
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("shared")}
                      className={`px-3 py-1.5 flex-1 ${
                        filterType === "shared"
                          ? "bg-[#16ba53] text-white"
                          : "text-slate-600"
                      }`}
                    >
                      Közös
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    A „Közös” opció a későbbi útitárs funkciónál lesz aktív.
                  </p>
                </div>

                <div className="flex gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Dátum tól
                    </label>
                    <input
                      type="date"
                      className="border rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Dátum ig
                    </label>
                    <input
                      type="date"
                      className="border rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>
                  Összes utazás: <strong>{trips.length}</strong>
                </span>
                <span>
                  Szűrt találatok: <strong>{filteredTrips.length}</strong>
                </span>
              </div>
            </div>

            {/* Lista / hiba / üzenetek */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Utazásaid</h2>
            </div>

            {loadingTrips && (
              <p className="text-sm text-slate-500">Utazások betöltése...</p>
            )}

            {tripsError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                {tripsError}
              </div>
            )}

            {!loadingTrips &&
              !tripsError &&
              filteredTrips.length === 0 &&
              trips.length > 0 && (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
                  Nincs a szűréseknek megfelelő utazás. Próbáld módosítani a
                  keresőt vagy a dátumokat.
                </div>
              )}

            {!loadingTrips &&
              !tripsError &&
              trips.length === 0 && (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
                  Még nincs egyetlen utazásod sem.{" "}
                  <Link
                    href="/new-trip"
                    className="text-[#16ba53] font-medium underline"
                  >
                    Hozz létre egyet most!
                  </Link>
                </div>
              )}

            {!loadingTrips && !tripsError && filteredTrips.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredTrips.map((trip) => {
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
