"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import type { Trip, TripExpense, TripMember } from "../../../lib/trip/types";

type User = {
  id: string;
  email?: string;
};

type TripHeaderProps = {
  trip: Trip;
  user: User | null;
  from: string;
  to: string;
  isOwner: boolean;
};

type TripStatus =
  | { key: "upcoming"; label: "Közelgő utazás"; color: string }
  | { key: "ongoing"; label: "Most zajlik"; color: string }
  | { key: "finished"; label: "Lezárult utazás"; color: string }
  | { key: "unknown"; label: "Ismeretlen státusz"; color: string };

function computeTripStatus(trip: Trip): TripStatus {
  if (!trip.date_from && !trip.date_to) {
    return {
      key: "unknown",
      label: "Ismeretlen státusz",
      color: "bg-slate-100 text-slate-600",
    };
  }

  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  let start: Date | null = null;
  let end: Date | null = null;

  if (trip.date_from) {
    const d = new Date(trip.date_from);
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (trip.date_to) {
    const d = new Date(trip.date_to);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (start && todayDate < start) {
    return {
      key: "upcoming",
      label: "Közelgő utazás",
      color: "bg-sky-50 text-sky-700",
    };
  }

  if (end && todayDate > end) {
    return {
      key: "finished",
      label: "Lezárult utazás",
      color: "bg-slate-100 text-slate-700",
    };
  }

  if ((start && todayDate >= start) || (end && todayDate <= end)) {
    return {
      key: "ongoing",
      label: "Most zajlik",
      color: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    key: "unknown",
    label: "Ismeretlen státusz",
    color: "bg-slate-100 text-slate-600",
  };
}

function computeDurationDays(trip: Trip): number | null {
  if (!trip.date_from || !trip.date_to) return null;
  try {
    const start = new Date(trip.date_from);
    const end = new Date(trip.date_to);
    const startDate = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    const endDate = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 ? diffDays + 1 : null; // inkluzív
  } catch {
    return null;
  }
}

export default function TripHeader({
  trip,
  user,
  from,
  to,
  isOwner,
}: TripHeaderProps) {
  const [loadingStats, setLoadingStats] = useState(true);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [totalsByCurrency, setTotalsByCurrency] = useState<
    Record<string, number>
  >({});
  const [statsError, setStatsError] = useState<string | null>(null);

  const status = computeTripStatus(trip);
  const durationDays = computeDurationDays(trip);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      setStatsError(null);

      try {
        // Utazók száma (accepted tagok)
        const { data: members, error: membersError } = await supabase
          .from("trip_members")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("status", "accepted");

        if (membersError) {
          console.error("Error loading members count", membersError);
          setStatsError("Nem sikerült betölteni az útitársak számát.");
        } else if (members) {
          setMembersCount(members.length);
        }

        // Költségek összesítése
        const { data: expenses, error: expensesError } = await supabase
          .from("trip_expenses")
          .select("amount, currency")
          .eq("trip_id", trip.id);

        if (expensesError) {
          console.error("Error loading expenses for header", expensesError);
          if (!statsError) {
            setStatsError("Nem sikerült betölteni a költség összefoglalót.");
          }
        } else if (expenses) {
          const totals = (expenses as TripExpense[]).reduce<
            Record<string, number>
          >((acc, exp) => {
            const cur = exp.currency || "EUR";
            const amt = Number(exp.amount) || 0;
            acc[cur] = (acc[cur] || 0) + amt;
            return acc;
          }, {});
          setTotalsByCurrency(totals);
        }
      } catch (e) {
        console.error(e);
        setStatsError("Váratlan hiba történt a statisztikák betöltésekor.");
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [trip.id]);

  const hasAnyStats =
    durationDays !== null ||
    membersCount !== null ||
    Object.keys(totalsByCurrency).length > 0;

  const formatMembersBadge = (count: number) => {
    if (count === 1) return "1 útitárs";
    return `${count} útitárs`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100 mb-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Bal oldal: cím, desztináció, dátum + státusz */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1">
            {trip.title}
          </h1>
          {trip.destination && (
            <p className="text-sm md:text-base text-slate-600 mb-1">
              {trip.destination}
            </p>
          )}
          {(from || to) && (
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-500">
              <span>
                {from} {from && to && "–"} {to}
              </span>
              {status.key !== "unknown" && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${status.color}`}
                >
                  {status.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Jobb oldal: owner badge, user, quick stats */}
        <div className="flex flex-col items-start md:items-end gap-2 min-w-[190px]">
          {isOwner && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
              Te vagy az utazás tulajdonosa
            </span>
          )}

          {user && user.email && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Bejelentkezve
                </span>
                <span className="text-[11px]">{user.email}</span>
              </div>
            </div>
          )}

          {hasAnyStats && (
            <div className="flex flex-wrap md:justify-end gap-1.5 mt-1">
              {durationDays !== null && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-50 text-[10px] md:text-[11px] text-slate-700">
                  {durationDays} napos utazás
                </span>
              )}

              {membersCount !== null && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-50 text-[10px] md:text-[11px] text-slate-700">
                  {formatMembersBadge(membersCount)}
                </span>
              )}

              {Object.keys(totalsByCurrency).map((cur) => (
                <span
                  key={cur}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-50 text-[10px] md:text-[11px] text-slate-700"
                >
                  Összes költés:{" "}
                  <span className="font-semibold ml-1">
                    {totalsByCurrency[cur].toFixed(2)} {cur}
                  </span>
                </span>
              ))}
            </div>
          )}

          {statsError && (
            <p className="text-[10px] text-red-500 max-w-xs text-right">
              {statsError}
            </p>
          )}
        </div>
      </div>

      {/* Gombsor */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/trip/${trip.id}/invite`}
          className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-emerald-500 text-emerald-600 text-xs font-medium hover:bg-emerald-50 transition"
        >
          Meghívó link
        </Link>

        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed"
        >
          TripTerv (hamarosan)
        </button>

        <Link
          href={`/trip/${trip.id}/stats`}
          className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 transition"
        >
          Statisztika
        </Link>
      </div>
    </div>
  );
}
