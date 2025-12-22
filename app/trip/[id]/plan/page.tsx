"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip } from "../../../../lib/trip/types";

export default function TripPlanPage() {
  const params = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrip = async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", params?.id)
        .single();

      if (error || !data) {
        router.push("/"); // Ha nincs trip, visszadobjuk
      } else {
        setTrip(data as Trip);
      }
      setLoading(false);
    };

    fetchTrip();
  }, [params, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#16ba53]"></div>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Navigáció vissza */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/trip/${trip.id}`}
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <span className="mr-1">←</span> Vissza az utazáshoz
          </Link>
        </div>

        {/* Címsor */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">TripTerv 🗺️</h1>
          <p className="text-sm text-slate-500">
            {trip.title} • Programok és időbeosztás
          </p>
        </div>

        {/* Placeholder tartalom (Hamarosan ide jön a lényeg) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Itt kezdődik a tervezés
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Hamarosan itt láthatod a napi bontású programtervet, a térképet és a bakancslistát.
            Az adatbázis már készen áll a programok fogadására!
          </p>
          <button className="px-6 py-2 bg-[#16ba53] text-white rounded-full font-medium text-sm shadow-md opacity-50 cursor-not-allowed">
            + Új program (Hamarosan)
          </button>
        </div>
      </div>
    </main>
  );
}