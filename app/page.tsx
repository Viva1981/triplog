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

// Státusz kiszámítása dátum alapján (Emoji nélkül!)
function getTripStatus(dateFrom: string | null, dateTo: string | null) {
  if (!dateFrom) return { label: "Tervezés alatt", color: "bg-slate-100 text-slate-600 border-slate-200" };
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const start = new Date(dateFrom);
  const end = dateTo ? new Date(dateTo) : new Date(dateFrom);

  if (now > end) {
    return { label: "Véget ért", color: "bg-slate-100 text-slate-500 border-slate-200" };
  }
  if (now >= start && now <= end) {
    return { label: "Zajlik éppen", color: "bg-emerald-50 text-[#16ba53] border-emerald-100 font-bold" };
  }
  
  const diffTime = Math.abs(start.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return { label: `${diffDays} nap múlva`, color: "bg-blue-50 text-blue-600 border-blue-100" };
}

// --- IKONOK (SVG) ---
// Letisztult, vékony vonalas ikonok
const Icons = {
  Search: () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
  ),
  Pin: () => (
    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  Calendar: () => (
    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  ArrowRight: () => (
    <svg className="w-3 h-3 text-slate-300 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
  ),
  Plane: () => (
    <svg className="w-5 h-5 text-[#16ba53]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
  )
};

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
          <Link href="/new-trip" className="flex items-center bg-[#16ba53] hover:bg-[#139a45] text-white px-4 py-2 rounded-full text-sm font-semibold transition shadow-sm hover:shadow active:scale-95">
            <Icons.Plus /> Új utazás
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

  // --- KIJELENTKEZETT NÉZET ---
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
              {/* Emojik törölve, itt is egyszerűsítettünk */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-1">
                    <h3 className="font-bold text-slate-800 mb-1">Galéria</h3>
                    <p className="text-xs text-slate-500">Fotók a saját tárhelyeden.</p>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-1">
                    <h3 className="font-bold text-slate-800 mb-1">Iratok</h3>
                    <p className="text-xs text-slate-500">Jegyek és foglalások.</p>
                 </div>
                 <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-1">
                    <h3 className="font-bold text-slate-800 mb-1">Költségek</h3>
                    <p className="text-xs text-slate-500">Pénzügyi áttekintés.</p>
                 </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#16ba53]"></div>
              <h2 className="text-xl font-bold text-slate-800 mb-4">Fontos infó az első belépéshez</h2>
              <div className="space-y-4 text-sm text-slate-600">
                <p>Mivel a TripLog egy független fejlesztés, és közvetlen hozzáférést kér a <strong>saját fájljaid feltöltéséhez</strong>, a Google első alkalommal biztonsági figyelmeztetést jeleníthet meg.</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 mb-2">Így tudsz belépni:</p>
                  <ul className="list-disc list-inside space-y-2 text-slate-700">
                    <li>Kattints a <span className="font-bold">Bejelentkezés</span> gombra.</li>
                    <li>Válaszd az <span className="font-bold">Advanced (Speciális)</span> lehetőséget.</li>
                    <li>Kattints a <span className="font-bold">Go to TripLog (unsafe)</span> linkre.</li>
                  </ul>
                </div>
                <button onClick={handleLogin} className="w-full mt-4 bg-[#16ba53] hover:bg-[#139a45] text-white py-3 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
                  Kezdjünk hozzá!
                </button>
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

        {/* SZŰRŐ SÁV (Clean SVG icons) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Keresés</label>
              <div className="relative">
                <span className="absolute left-3 top-3"><Icons.Search /></span>
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] transition appearance-none"
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
            <h3 className="text-lg font-semibold text-slate-900">Még nincs itt semmi</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
              Úgy tűnik, még nem hoztál létre utazást, vagy a keresés nem adott találatot.
            </p>
            <Link href="/new-trip" className="inline-flex items-center gap-2 bg-[#16ba53] hover:bg-[#139a45] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-sm">
              <Icons.Plus /> Első utazás létrehozása
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip) => {
              const status = getTripStatus(trip.date_from, trip.date_to);

              return (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="group block bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all duration-300 overflow-hidden flex flex-col h-full"
                >
                  {/* Kártya fejléce: Monokróm zöld átmenet + SVG ikon */}
                  <div className="h-24 bg-gradient-to-br from-[#16ba53] to-[#139a45] relative">
                    <div className="absolute bottom-[-16px] left-5">
                       <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-50">
                          <Icons.Plane />
                       </div>
                    </div>
                  </div>

                  <div className="p-5 pt-7 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide border ${status.color}`}>
                        {status.label}
                      </span>
                      {trip.memberRole === "owner" ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 uppercase">
                          Saját
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 uppercase">
                          Megosztott
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#16ba53] transition-colors line-clamp-1 mb-1">
                      {trip.title}
                    </h3>
                    
                    <div className="text-sm text-slate-500 flex items-center gap-2 mb-4">
                      <Icons.Pin />
                      <span className="truncate">{trip.destination || "Ismeretlen helyszín"}</span>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
                       <div className="flex items-center gap-1.5">
                          <Icons.Calendar />
                          <span>{trip.date_from || "?"}</span>
                       </div>
                       <Icons.ArrowRight />
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