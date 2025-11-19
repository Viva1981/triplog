"use client";

import { useEffect, useMemo, useState } from "react";
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
  onScrollToExpenses: () => void;
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
  onScrollToExpenses,
}: TripHeaderProps) {
  const [loadingStats, setLoadingStats] = useState(true);
  const [members, setMembers] = useState<TripMember[]>([]);
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
        // Accepted tagok lekérése (résztvevők)
        const { data: memberRows, error: membersError } = await supabase
          .from("trip_members")
          .select("id, trip_id, user_id, role, status, display_name, email")
          .eq("trip_id", trip.id)
          .eq("status", "accepted");

        if (membersError) {
          console.error("Error loading members", membersError);
          setStatsError("Nem sikerült betölteni az útitársakat.");
        } else if (memberRows) {
          setMembers(memberRows as TripMember[]);
        }

        // Költségek összesítése pénznemenként
        const { data: expenses, error: expensesError } = await supabase
          .from("trip_expenses")
          .select("amount, currency")
          .eq("trip_id", trip.id);

        if (expensesError) {
          console.error("Error loading expenses for header", expensesError);
          setStatsError(
            (prev) =>
              prev ?? "Nem sikerült betölteni a költség összefoglalót."
          );
        } else if (expenses) {
          const totals = (expenses as TripExpense[]).reduce<
            Record<string, number>
          >((acc, exp) => {
            const cur = (exp.currency || "EUR").toUpperCase();
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

  const memberCount = members.length;

  const memberNamesTooltip = useMemo(() => {
    if (memberCount <= 1) return "";
    return members
      .map((m) => {
        const baseName =
          (m as any).display_name || (m as any).email || "Ismeretlen utazó";
        if (user && m.user_id === user.id) {
          return `${baseName} (te)`;
        }
        return baseName;
      })
      .join(", ");
  }, [members, memberCount, user]);

  const hasAnyStats =
    durationDays !== null ||
    memberCount > 1 ||
    Object.keys(totalsByCurrency).length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100 mb-4">
      {/* Felső sor: cím + user blokk */}
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

          {isOwner && (
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
              Te vagy az utazás tulajdonosa
            </div>
          )}
        </div>

        {/* Jobb oldal: bejelentkezett user infó */}
        <div className="flex items-center gap-2 md:items-start">
          {user && user.email && (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  Bejelentkezve
                </span>
                <span className="text-[12px] text-slate-700 font-medium">
                  {user.email}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gyors statok sor */}
      {hasAnyStats && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {durationDays !== null && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-[11px] md:text-[12px] text-slate-700">
              {durationDays} napos utazás
            </span>
          )}

          {memberCount > 1 && (
            <div className="relative group">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-[11px] md:text-[12px] text-slate-700">
                Résztvevők: {memberCount} fő
              </span>
              {memberNamesTooltip && (
                <div className="absolute left-0 mt-1 hidden group-hover:block bg-white border border-slate-200 rounded-xl shadow-lg p-2 text-[11px] text-slate-700 z-20 max-w-xs">
                  {memberNamesTooltip}
                </div>
              )}
            </div>
          )}

          {Object.entries(totalsByCurrency).map(([cur, total]) => (
            <span
              key={cur}
              className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-[11px] md:text-[12px] text-slate-700"
            >
              {cur.toUpperCase()} összesen:{" "}
              <span className="font-semibold ml-1">
                {total.toLocaleString("hu-HU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {cur.toUpperCase()}
              </span>
            </span>
          ))}
        </div>
      )}

      {statsError && (
        <p className="mt-2 text-[11px] text-red-500 max-w-xs">
          {statsError}
        </p>
      )}

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

        <button
          type="button"
          onClick={onScrollToExpenses}
          className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-slate-400 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
        >
          Költség hozzáadása
        </button>
      </div>
    </div>
  );
}
