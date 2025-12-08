"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import type { Trip, TripExpense, TripMember } from "../../../lib/trip/types";

// Város autocomplete ugyanaz, mint az új utazás oldalon
import DestinationAutocomplete from "../../new-trip/DestinationAutocomplete";

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

function formatDateLabel(value?: string | null): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
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
  // Az aktuálisan megjelenített trip állapot (mentés után frissítjük)
  const [localTrip, setLocalTrip] = useState<Trip>(trip);
  const [displayFrom, setDisplayFrom] = useState(from);
  const [displayTo, setDisplayTo] = useState(to);

  // Szerkesztő állapot
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(trip.title ?? "");
  const [editDestination, setEditDestination] = useState(
    trip.destination ?? ""
  );
  const [editDateFrom, setEditDateFrom] = useState(
    trip.date_from ? trip.date_from.slice(0, 10) : ""
  );
  const [editDateTo, setEditDateTo] = useState(
    trip.date_to ? trip.date_to.slice(0, 10) : ""
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Ha kívülről változik a trip (másik utazásra navigálsz), szinkronizálunk
  useEffect(() => {
    setLocalTrip(trip);
    setDisplayFrom(from);
    setDisplayTo(to);
    setEditTitle(trip.title ?? "");
    setEditDestination(trip.destination ?? "");
    setEditDateFrom(trip.date_from ? trip.date_from.slice(0, 10) : "");
    setEditDateTo(trip.date_to ? trip.date_to.slice(0, 10) : "");
    setIsEditing(false);
    setEditError(null);
  }, [trip, from, to]);

  const status = computeTripStatus(localTrip);
  const durationDays = computeDurationDays(localTrip);

  const [loadingStats, setLoadingStats] = useState(true);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [totalsByCurrency, setTotalsByCurrency] = useState<
    Record<string, number>
  >({});
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      setStatsError(null);

      try {
        // Accepted tagok
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
            (prev) => prev ?? "Nem sikerült betölteni a költség összefoglalót."
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

  // ---------------------------------------------------------
  // Szerkesztés mentése
  // ---------------------------------------------------------
  const handleSaveEdit = async (e: any) => {
    e.preventDefault();
    if (!isOwner) return;

    if (!editTitle.trim()) {
      setEditError("Az utazás címe kötelező.");
      return;
    }

    if (!editDateFrom) {
      setEditError("A kezdő dátum megadása kötelező.");
      return;
    }

    if (editDateTo && new Date(editDateTo) < new Date(editDateFrom)) {
      setEditError("A befejező dátum nem lehet korábbi, mint a kezdő dátum.");
      return;
    }

    setEditError(null);
    setSavingEdit(true);

    try {
      const { data, error } = await supabase
        .from("trips")
        .update({
          title: editTitle.trim(),
          destination: editDestination.trim() || null,
          date_from: editDateFrom,
          date_to: editDateTo || null,
        })
        .eq("id", trip.id)
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
        .single();

      if (error || !data) {
        console.error("TRIP UPDATE ERROR", error);
        setEditError("Nem sikerült menteni a módosításokat.");
        return;
      }

      const updated = data as Trip;
      setLocalTrip(updated);
      setDisplayFrom(formatDateLabel(updated.date_from));
      setDisplayTo(formatDateLabel(updated.date_to));
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setEditError("Váratlan hiba történt mentés közben.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(localTrip.title ?? "");
    setEditDestination(localTrip.destination ?? "");
    setEditDateFrom(localTrip.date_from ? localTrip.date_from.slice(0, 10) : "");
    setEditDateTo(localTrip.date_to ? localTrip.date_to.slice(0, 10) : "");
    setEditError(null);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100 mb-4">
      {/* Felső sor: cím + user blokk */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Bal oldal: cím, desztináció, dátum + státusz */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1">
            {localTrip.title}
          </h1>
          {localTrip.destination && (
            <p className="text-sm md:text-base text-slate-600 mb-1">
              {localTrip.destination}
            </p>
          )}
          {(displayFrom || displayTo) && (
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-500">
              <span>
                {displayFrom} {displayFrom && displayTo && "–"} {displayTo}
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
            <>
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                Te vagy az utazás tulajdonosa
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  setEditError(null);
                }}
                className="mt-2 inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
              >
                ✏️ Utazás adatainak szerkesztése
              </button>
            </>
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

      {/* Szerkesztő panel */}
      {isOwner && isEditing && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <form
            onSubmit={handleSaveEdit}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-3 md:p-4 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Utazás címe *
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Desztináció
              </label>
              <DestinationAutocomplete
                value={editDestination}
                onChange={setEditDestination}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Kezdő dátum *
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                  value={editDateFrom}
                  onChange={(e) => setEditDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Befejező dátum
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                  value={editDateTo}
                  onChange={(e) => setEditDateTo(e.target.value)}
                />
              </div>
            </div>

            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {editError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-slate-300 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50"
              >
                Mégse
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {savingEdit ? "Mentés..." : "Változások mentése"}
              </button>
            </div>
          </form>
        </div>
      )}

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
        <p className="mt-2 text-[11px] text-red-500 max-w-xs">{statsError}</p>
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
