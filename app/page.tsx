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

// --- SEGÉDFÜGGVÉNYEK ---

// Státusz kiszámítása dátum alapján
function getTripStatus(dateFrom: string | null, dateTo: string | null) {
  if (!dateFrom) return { label: "Tervezés alatt", color: "bg-slate-100 text-slate-600" };
  
  const now = new Date();
  // Reseteljük az órát, hogy csak a nap számítson
  now.setHours(0, 0, 0, 0);
  
  const start = new Date(dateFrom);
  const end = dateTo ? new Date(dateTo) : new Date(dateFrom); // Ha nincs vége, akkor 1 napos

  if (now > end) {
    return { label: "Véget ért", color: "bg-slate-100 text-slate-500" };
  }
  if (now >= start && now <= end) {
    return { label: "Zajlik éppen! ✈️", color: "bg-emerald-100 text-emerald-700 font-bold" };
  }
  
  // Napok kiszámolása a jövőben
  const diffTime = Math.abs(start.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return { label: `${diffDays} nap múlva`, color: "bg-blue-50 text-blue-600" };
}

// Random színátmenet generálása a cím alapján (hogy minden útnak legyen egy fix színe)
function getGradient(title: string) {
  const gradients = [
    "from-emerald-400 to-cyan-400",
    "from-blue-400 to-indigo-400",
    "from-orange-400 to-rose-400",
    "from-purple-400 to-pink-400",
    "from-lime-400 to-emerald-400",
    "from-teal-400 to-blue-400",
  ];
  const index = title.length % gradients.length;
  return gradients[index];
}

// --- NAVBAR ---
const AppNavbar = ({ user }: { user: User | null }) => {
  const router = useRouter();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
          <Link href="/new-trip" className="bg-[#16ba53] hover:bg-[#139a45] text-white px-4 py-2 rounded-full text-sm font-semibold transition shadow-sm hover:shadow active:scale-95">
            + Új utazás
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

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUser(null);
        setLoadingUser(false);
        return;
      }
      setUser({ id: user.id, email: user.email ?? undefined });
      setLoadingUser(false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadTrips = async () => {
      if (!user) {
        setTrips([]);
        return;
      }
      setLoadingTrips(true);
      setError(null);
      try {
        const { data: memberships } = await supabase
          .from("trip_members")
          .select("trip_id, role")
          .eq("user_id", user.id);

        const membershipList = (memberships ?? []) as Membership[];
        if (membershipList.length === 0) {
          setTrips([]);
          setLoadingTrips(false);
          return;
        }
        const tripIds = membershipList.map((m) => m.trip_id);
        const { data: tripsData } = await supabase
          .from("trips")
          .select("*")
          .in("id", tripIds);

        const tripsList = (tripsData ?? []) as Trip[];
        const merged: TripWithRole[] = tripsList.map((t) => {
          const membership = membershipList.find((m) => m.trip_id === t.id);
          return { ...t, memberRole: membership?.role ?? "member" };
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

  const filteredTrips = useMemo(() => {
    let list = [...trips];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.destination ?? "").toLowerCase().includes(q)
      );
    }
    if (filterType === "own") list = list.filter((t) => t.memberRole === "owner");
    else if (filterType === "shared") list = list.filter((t) => t.memberRole !== "owner");
    if (filterFrom) list = list.filter((t) => !t.date_from || t.date_from >= filterFrom);
    if (filterTo) list = list.filter((t) => !t.date_to || t.date_to <= filterTo);

    list.sort((a, b) => new Date(a.date_from ?? "2100-01-01").getTime() - new Date(b.date_from ?? "2100-01-01").getTime());
    return list;
  }, [trips, search, filterType, filterFrom, filterTo]);

  if (loadingUser) return <main className="min-h-screen flex items-center justify-center"><p>Betöltés...</p></main>;

  // --- KIJELENTKEZETT NÉZET (Landing Page) ---
  if (!user) {
    const handleLogin = async () => {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
          queryParams: { access_type: "offline", prompt: "consent" },
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
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">📸</div><div><h3 className="font-bold text-slate-800">Galéria</h3><p className="text-xs text-slate-500">Fotók rendszerezve</p></div></div>
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl">📂</div><div><h3 className="font-bold text-slate-800">Dokumentumok</h3><p className="text-xs text-slate-500">Jegyek, foglalások</p></div></div>
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-xl">📊</div><div><h3 className="font-bold text-slate-800">Költségek</h3><p className="text-xs text-slate-500">Pénzügyi áttekintés</p></div></div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#16ba53]"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">⚠️ Fontos infó az első belépéshez</h2>
              <div className="space-y-4 text-sm text-slate-600">
                <p>Mivel a TripLog egy független fejlesztés, és közvetlen hozzáférést kér a <strong>saját fájljaid feltöltéséhez</strong>, a Google első alkalommal biztonsági figyelmeztetést jeleníthet meg.</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 mb-2">Így tudsz belépni:</p>
                  <ol className="list-decimal list-inside space-y-2 marker:text-[#16ba53] marker:font-bold">
                    <li>Kattints a <span className="font-bold text-slate-900">Bejelentkezés</span> gombra.</li>
                    <li>A figyelmeztető képernyőn válaszd a <span className="font-bold text-slate-900">Advanced (Speciális)</span> lehetőséget.</li>
                    <li>Kattints a <span className="font-bold text-slate-900">Go to TripLog (unsafe)</span> linkre alul.</li>
                  </ol>
                </div>
                <button onClick={handleLogin} className="w-full mt-4 bg-[#16ba53] hover:bg-[#139a45] text-white py-3 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98]">Kezdjünk hozzá! </button>
              </div>
            </div>
          </div>
        </div>
        <footer className="text-center py-6 text-slate-400 text-xs"><p>&copy; {new Date().getFullYear()} TripLog. Minden jog fenntartva.</p></footer>
      </main>
    );
  }

  // --- BEJELENTKEZETT NÉZET ---
  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <AppNavbar user={user} />
      
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Utazásaid</h1>
            <p className="text-sm text-slate-600 mt-1">
              Kezeld a saját és közös utazásaidat egy helyen.
            </p>
          </div>
        </section>

        {/* SZŰRŐ SÁV (Kompaktabb, modernebb) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Keresés</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Horvátország, Tátra..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] transition"
                />
              </div>
            </div>

            <div className="w-full md:w-48">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Típus</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] transition"
              >
                <option value="all">Minden utazás</option>
                <option value="own">Saját utazások</option>
                <option value="shared">Megosztott velem</option>
              </select>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kezdés</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vége</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] transition"
                />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loadingTrips ? (
          <div className="py-12 text-center">
             <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#16ba53] mb-3"></div>
             <p className="text-sm text-slate-500">Utazások betöltése...</p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="text-4xl mb-3">🌍</div>
            <h3 className="text-lg font-semibold text-slate-900">Még nincs itt semmi</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
              Úgy tűnik, még nem hoztál létre utazást, vagy a keresés nem adott találatot.
            </p>
            <Link href="/new-trip" className="inline-flex items-center gap-2 bg-[#16ba53] hover:bg-[#139a45] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-sm">
              + Első utazás létrehozása
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => {
              const status = getTripStatus(trip.date_from, trip.date_to);
              const gradient = getGradient(trip.title);

              return (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="group block bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all duration-300 overflow-hidden flex flex-col h-full"
                >
                  {/* Kártya fejléce (Gradient) */}
                  <div className={`h-24 bg-gradient-to-r ${gradient} relative`}>
                    <div className="absolute bottom-[-16px] left-5">
                       <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">
                          ✈️
                       </div>
                    </div>
                  </div>

                  <div className="p-5 pt-7 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${status.color}`}>
                        {status.label}
                      </span>
                      {trip.memberRole === "owner" ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          SAJÁT
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                          MEGOSZTOTT
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#16ba53] transition-colors line-clamp-1 mb-1">
                      {trip.title}
                    </h3>
                    
                    <div className="text-sm text-slate-500 flex items-center gap-1 mb-4">
                      <span>📍</span>
                      <span className="truncate">{trip.destination || "Ismeretlen helyszín"}</span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
                       <span>📅 {trip.date_from || "?"}</span>
                       <span>➝</span>
                       <span>{trip.date_to || "?"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}