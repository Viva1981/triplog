"use client";

import Link from "next/link";

type User = {
  id: string;
  email?: string | null;
};

type TripHeaderProps = {
  trip: {
    id: string;
    owner_id: string;
    title: string;
    destination?: string | null;
  };
  user: User | null;
  from: string | null;
  to: string | null;
  isOwner: boolean;
  onScrollToStats: () => void;
};

export default function TripHeader({
  trip,
  user,
  from,
  to,
  isOwner,
  onScrollToStats,
}: TripHeaderProps) {
  return (
    <section className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Bal oldal: cím, desztináció, dátumok */}
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

        {/* Jobb oldal: owner badge + email + akció gombok */}
        <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
          <div className="flex flex-col items-start md:items-end gap-1">
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

          <div className="flex flex-wrap gap-2 justify-end w-full">
            <Link
              href={`/trip/${trip.id}/invite`}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Meghívó link
            </Link>

            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-full border border-slate-100 bg-slate-50 text-xs font-medium text-slate-400 cursor-not-allowed"
            >
              TripTerv (hamarosan)
            </button>

            <button
              type="button"
              onClick={onScrollToStats}
              className="px-3 py-1.5 rounded-full bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 transition"
            >
              Statisztika
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
