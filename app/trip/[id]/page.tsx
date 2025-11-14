"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type User = {
  id: string;
  email?: string;
};

type Trip = {
  id: string;
  owner_id: string;
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
    return dateStr ?? "";
  }
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();

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
        router.push("/"); // nincs login → vissza a főoldalra
        return;
      }

      setUser({ id: user.id, email: user.email ?? undefined });
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
        .select("id, owner_id, title, destination, date_from, date_to")
        .eq("id", tripId)
        .single();

      if (error || !data) {
        console.error("TRIP FETCH ERROR:", error);
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

    // Csak akkor kérjük le, ha már az auth lefutott (különben feleslegesen kérdezzük)
    if (!loadingUser) {
      fetchTrip();
    }
  }, [params, loadingUser]);

  if (loadingUser || loadingTrip) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">
            Hiba az utazás betöltése közben
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

  const from = formatDate(trip.date_from);
  const to = formatDate(trip.date_to);

  const isOwner = user && user.id === trip.owner_id;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Vissza link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <span className="mr-1">←</span> Vissza a főoldalra
          </Link>
        </div>

        {/* Fő info kártya */}
        <section className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold mb-1">{trip.title}</h1>
              <p className="text-sm text-slate-600 mb-1">
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

            <div className="flex flex-col items-start md:items-end gap-2">
              {isOwner && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#16ba53]/10 text-[#16ba53] text-xs font-semibold">
                  Te vagy az utazás tulajdonosa
                </span>
              )}
              {user?.email && (
                <div className="text-right text-[11px] text-slate-500">
                  <p className="font-semibold">Bejelentkezve:</p>
                  <p>{user.email}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Szekciók – placeholder-ek a jövőbeli funkcióknak */}

        <section className="grid gap-4 md:grid-cols-2">
          {/* Fotók */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Fotók</h2>
            <p className="text-xs text-slate-500">
              Ide kerülnek majd az utazáshoz tartozó fotók a Google Drive-ból.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📷
            </div>
          </div>

          {/* Dokumentumok */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Dokumentumok</h2>
            <p className="text-xs text-slate-500">
              Itt fognak megjelenni a beszállókártyák, foglalások, szerződések
              és egyéb fájlok.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📄
            </div>
          </div>

          {/* Jegyzet */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Jegyzet</h2>
            <p className="text-xs text-slate-500">
              Utazási terv, emlékek, teendők, tennivalók – minden egy helyen.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📝
            </div>
          </div>

          {/* Költségek */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Költségek</h2>
            <p className="text-xs text-slate-500">
              Itt tudod majd rögzíteni, ki mit fizetett, milyen kategóriában és
              milyen pénznemben.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 💸
            </div>
          </div>

          {/* Költségek statisztika – teljes szélesség */}
        </section>

        <section className="mt-4">
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Költségek statisztika</h2>
            <p className="text-xs text-slate-500">
              Itt fogsz kördiagramot látni arról, mire mennyit költöttetek az
              utazás során.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📊
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
