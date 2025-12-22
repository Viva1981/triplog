"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// --- NAVBAR KOMPONENS ---
const AppNavbar = ({ user }: { user: User | null }) => {
  const router = useRouter();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // JAVÍTÁS: drive.file helyett sima drive (teljes hozzáférés a megosztott fájlokhoz)
        scopes:
          "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#16ba53] rounded-full flex items-center justify-center text-white font-bold text-xl">
          T
        </div>
        <span className="text-xl font-bold text-slate-800 hidden sm:block">TripLog</span>
      </Link>
      
      {user ? (
        <div className="flex items-center gap-2">
          <Link href="/new-trip" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-sm font-semibold transition">
            Új utazás
          </Link>
          <Link href="/profile" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-sm font-semibold transition">
            Profil
          </Link>
          <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2">
            Kijelentkezés
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="bg-[#16ba53] hover:bg-[#139a45] text-white px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          Bejelentkezés Google-lel
        </button>
      )}
    </nav>
  );
};

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

  // --- NINCS BEJELENTKEZVE: HERO PAGE MEGJELENÍTÉSE ---
  if (!user) {
    const handleLogin = async () => {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // JAVÍTÁS: drive.file helyett sima drive
          scopes:
            "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    };

    return (
      <main className="min-h-screen bg-slate-50 flex flex-col">
        <AppNavbar user={null} />

        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-6xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            <div className="text-left space-y-6">
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                Utazásaid minden emléke <br />
                <span className="text-[#16ba53]">egyetlen helyen.</span>
              </h1>
              <p className="text-lg text-slate-600">
                Tervezz, fotózz, mentsd a dokumentumokat és kövesd a költségeket.
                A TripLog mindent automatikusan a <strong>saját Google Drive-odba</strong> rendszerez.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">
                    📸
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Galéria</h3>
                    <p className="text-xs text-slate-500">Fotók rendszerezve</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl">
                    📂
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Dokumentumok</h3>
                    <p className="text-xs text-slate-500">Jegyek, foglalások</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-xl">
                    📊
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Költségek</h3>
                    <p className="text-xs text-slate-500">Pénzügyi áttekintés</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#16ba53]"></div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                ⚠️ Fontos infó az első belépéshez
              </h2>
              
              <div className="space-y-4 text-sm text-slate-600">
                <p>
                  Mivel a TripLog egy független fejlesztés, és közvetlen hozzáférést kér 
                  a <strong>saját fájljaid feltöltéséhez</strong>, a Google első alkalommal 
                  biztonsági figyelmeztetést jeleníthet meg.
                </p>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 mb-2">Így tudsz belépni:</p>
                  <ol className="list-decimal list-inside space-y-2 marker:text-[#16ba53] marker:font-bold">
                    <li>
                      Kattints a <span className="font-bold text-slate-900">Bejelentkezés</span> gombra.
                    </li>
                    <li>
                      A figyelmeztető képernyőn válaszd a <span className="font-bold text-slate-900">Advanced (Speciális)</span> lehetőséget.
                    </li>
                    <li>
                      Kattints a <span className="font-bold text-slate-900">Go to TripLog (unsafe)</span> linkre alul.
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  *Az "unsafe" (nem biztonságos) jelzés kizárólag azt jelenti, hogy az alkalmazást 
                  még nem auditálta a Google marketing csapata. Az adataid sosem hagyják el a saját Google fiókodat.
                </p>

                <button
                  onClick={handleLogin}
                  className="w-full mt-4 bg-[#16ba53] hover:bg-[#139a45] text-white py-3 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  Kezdjünk hozzá! 
                </button>
              </div>
            </div>

          </div>
        </div>

        <footer className="text-center py-6 text-slate-400 text-xs">
          <p>&copy; {new Date().getFullYear()} TripLog. Minden jog fenntartva.</p>
        </footer>
      </main>
    );
  }

  // --- BEJELENTKEZVE: UTAZÁS LISTA ---
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <AppNavbar user={user} />
      
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