"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import hu from "date-fns/locale/hu";

import { TripInfo, TripMemberInfo } from "@/lib/trip/types";

type TripHeaderProps = {
  trip: TripInfo;
  members: TripMemberInfo[];
  userEmail: string | null;
  userName: string | null;
  userInitials: string;
  totalByCurrency: { [currency: string]: number };
  onScrollToExpenses: () => void;
  isOwner: boolean;
};

// ---- Badge helper ----
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium mr-2 mb-2">
      {children}
    </span>
  );
}

export default function TripHeader({
  trip,
  members,
  userEmail,
  userName,
  userInitials,
  totalByCurrency,
  isOwner,
  onScrollToExpenses,
}: TripHeaderProps) {
  const memberCount = members.length;

  // --- Trip status ---
  const statusLabel = useMemo(() => {
    const today = new Date();
    const from = trip.date_from ? new Date(trip.date_from) : null;
    const to = trip.date_to ? new Date(trip.date_to) : null;

    if (from && to) {
      if (today < from) return { label: "Közelgő utazás", color: "bg-blue-100 text-blue-700" };
      if (today >= from && today <= to) return { label: "Most zajlik", color: "bg-emerald-100 text-emerald-700" };
      if (today > to) return { label: "Lezárult utazás", color: "bg-slate-200 text-slate-700" };
    }
    return null;
  }, [trip.date_from, trip.date_to]);

  // --- Duration ---
  const durationDays = useMemo(() => {
    if (!trip.date_from || !trip.date_to) return null;
    const start = new Date(trip.date_from);
    const end = new Date(trip.date_to);
    const diff = Math.round(Math.abs(+end - +start) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [trip.date_from, trip.date_to]);

  // --- Member list tooltip text ---
  const memberNames = useMemo(() => {
    return members
      .map((m) => {
        if (m.is_current_user) return `${m.display_name ?? m.email} (te)`;
        return m.display_name ?? m.email ?? "Ismeretlen utazó";
      })
      .join(", ");
  }, [members]);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
      {/* TITLE & META */}
      <div className="flex flex-col md:flex-row md:justify-between gap-6">

        {/* LEFT SIDE */}
        <div>
          <h1 className="text-3xl font-bold mb-1">{trip.title}</h1>
          {trip.destination && (
            <p className="text-slate-600 text-lg mb-1">{trip.destination}</p>
          )}

          {/* Dates + status */}
          <div className="flex items-center gap-3 flex-wrap">

            {trip.date_from && trip.date_to && (
              <span className="text-slate-700">
                {format(new Date(trip.date_from), "yyyy. MM. dd.", { locale: hu })} –{" "}
                {format(new Date(trip.date_to), "yyyy. MM. dd.", { locale: hu })}
              </span>
            )}

            {statusLabel && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabel.color}`}
              >
                {statusLabel.label}
              </span>
            )}
          </div>

          {/* OWNER BADGE */}
          {isOwner && (
            <div className="mt-3 inline-block px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
              Te vagy az utazás tulajdonosa
            </div>
          )}
        </div>

        {/* RIGHT SIDE – USER INFO */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 font-semibold text-lg">
            {userInitials}
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
              Bejelentkezve
            </p>
            <p className="text-sm text-slate-700 font-medium">
              {userName ?? userEmail}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="mt-5 flex flex-wrap items-center gap-2">

        {/* Duration */}
        {durationDays && <Badge>{durationDays} napos utazás</Badge>}

        {/* Members */}
        {memberCount > 1 && (
          <div className="relative group">
            <Badge>Résztvevők: {memberCount} fő</Badge>
            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-white border border-slate-200 shadow-lg rounded-lg p-3 text-sm text-slate-700 z-20 w-max max-w-xs">
              {memberNames}
            </div>
          </div>
        )}

        {/* COSTS BY CURRENCY */}
        {Object.entries(totalByCurrency).map(([currency, amount]) => (
          <Badge key={currency}>
            {currency} összesen:{" "}
            {amount.toLocaleString("hu-HU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Badge>
        ))}
      </div>

      {/* ACTION BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/trip/${trip.id}/invite`}
          className="px-5 py-2 rounded-full border border-emerald-500 text-emerald-600 font-medium hover:bg-emerald-50 transition"
        >
          Meghívó link
        </Link>

        <button
          disabled
          className="px-5 py-2 rounded-full bg-slate-100 text-slate-500 font-medium cursor-not-allowed"
        >
          TripTerv (hamarosan)
        </button>

        <Link
          href={`/trip/${trip.id}/stats`}
          className="px-5 py-2 rounded-full bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition"
        >
          Statisztika
        </Link>

        <button
          onClick={onScrollToExpenses}
          className="px-5 py-2 rounded-full border border-slate-400 text-slate-700 font-medium hover:bg-slate-50 transition"
        >
          Költség hozzáadása
        </button>
      </div>
    </div>
  );
}
