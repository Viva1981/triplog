"use client";

import { useEffect, useMemo, useState } from "react";
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
  owner_id: string;
};

type Membership = {
  trip_id: string;
  role: "owner" | "member";
};

type TripWithRole = Trip & { memberRole: "owner" | "member" };

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trips, setTrips] = useState<TripWithRole[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "own" | "shared">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // --- USER BETÖLTÉSE ---
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoadingUser(false);
        return;
      }

      setUser({
        id: user.id,
        email: user.email ?? undefined,
      });
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  // --- UTAZÁSOK BETÖLTÉSE (csak ha van user) ---
  useEffect(() => {
    const loadTrips = async () => {
      if (!user) {
        setTrips([]);
        return;
      }

      setLoadingTrips(true);
      setError(null);

      try {
        // 1) tagságok
        const { data: memberships, error: memberError } = await supabase
          .from("trip_members")
          .select("trip_id, role")
          .eq("user_id", user.id);

        if (memberError) {
          console.error(memberError);
          throw new Error("Nem sikerült betölteni az utazásokat.");
        }

        const membershipList = (memberships ?? []) as Membership[];

        if (membershipList.length === 0) {
          setTrips([]);
          setLoadingTrips(false);
          return;
        }

        const tripIds = membershipList.map((m) => m.trip_id);

        // 2) utak
        const { data: tripsData, error: tripsError } = await supabase
          .from("trips")
          .select("*")
          .in("id", tripIds);

        if (tripsError) {
          console.error(tripsError);
          throw new Error("Nem sikerült betölteni az utazásokat.");
        }

        const tripsList = (tripsData ?? []) as Trip[];

        const merged: TripWithRole[] = tripsList.map((t) => {
          const membership = membershipList.find((m) => m.trip_id === t.id);
          return {
            ...t,
            memberRole: membership?.role ?? "member",
          };
        });

        setTrips(merged);
      } catch (err: any) {
        setError(err?.message ?? "Ismeretlen hiba történt.");
      } finally {
        setLoadingTrips(false);
      }
    };

    loadTrips();
  }, [user]);

  // --- SZŰRT LISTA ---
  const filteredTrips = useMemo(() => {
    let list = [...trips];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.destination ?? "").toLowerCase().includes(q)
      );
    }

    if (filterType === "own") {
      list = list.filter((t) => t.memberRole === "owner");
    } else if (filterType === "shared") {
      list = list.filter((t) => t.memberRole !== "owner");
    }

    if (filterFrom) {
      list = list.filter((t) => !t.date_from || t.date_from >= filterFrom);
    }
    if (filterTo) {
      list = list.filter((t) => !t.date_to || t.date_to <= filterTo);
    }

    list.sort(
      (a, b) =>
        new Date(a.date_from ?? "2100-01-01").getTime() -
        new Date(b.date_from ?? "2100-01-01").getTime()
    );

    return list;
  }, [trips, search, filterType, filterFrom, filterTo]);

  // --- LOADING ÁLLAPOT ---
  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  // --- NINCS BEJELENTKEZVE: NINCS TÖBBÉ LOGIN GOMB ITT :) ---
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center pt-16 px-4">
        <section className="w-full max-w-4xl mb-10">
          <h1 className="text-3xl font-bold mb-2 text-slate-900">TripLog</h1>
          <p className="text-slate-600">
            Utazások tervezése, dokumentálása, költségek egy helyen.
          </p>
        </section>

        <section className="w-full max-w-xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-3">
              Kezdd azzal, hogy bejelentkezel
            </h2>
            <p className="text-slate-600 mb-4 text-sm">
              A jobb felső sarokban található{" "}
              <span className="font-semibold">„Bejelentkezés Google-lel”</span>{" "}
              gombbal tudsz belépni. Ezután létrehozhatod az első utazásodat,
              rögzítheted a költségeket, és feltöltheted a fotókat és
              dokumentumokat.
            </p>
            <p className="text-xs text-slate-400">
              (Itt később lehet valami menő bemutató / reklám blokk a TripLog
              funkcióiról. 😉)
            </p>
          </div>
        </section>
      </main>
    );
  }

  // --- BEJELENTKEZVE: UTAZÁS LISTA ---
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-10 space-y-8">
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Utazásaid</h1>
          <p className="text-sm text-slate-600">
            Itt találod az összes saját és közös utazásodat. Használd a
            keresőt és a szűrőket, ha sok utad van.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Keresés (cím / desztináció)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pl.: Horvátország, Miskolc..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Típus
              </label>
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "all" | "own" | "shared")
                }
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
              >
                <option value="all">Összes utazás</option>
                <option value="own">Csak saját (te vagy a tulaj)</option>
                <option value="shared">Közös utazások</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Dátumtól
                </label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Dátumig
                </label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {loadingTrips ? (
            <p className="text-sm text-slate-500">Utazások betöltése...</p>
          ) : filteredTrips.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nincs még egyetlen utazásod sem. Hozz létre egyet az{" "}
              <span className="font-semibold">„Új utazás”</span> gombbal a jobb
              felső sarokban.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 transition"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">
                      {trip.title}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {trip.memberRole === "owner" ? "Tulajdonos" : "Útitárs"}
                    </span>
                  </div>
                  {trip.destination && (
                    <p className="text-sm text-slate-700 mb-1">
                      {trip.destination}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {trip.date_from || trip.date_to
                      ? `${trip.date_from ?? "?"} – ${trip.date_to ?? "?"}`
                      : "Dátum nélkül"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
