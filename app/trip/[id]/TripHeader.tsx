"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import type { Trip, TripExpense, TripMember } from "../../../lib/trip/types";
import DestinationAutocomplete from "../../new-trip/DestinationAutocomplete";

// --- IKONOK (SVG) ---
const Icons = {
  Pin: () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  ),
  Pencil: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
  ),
  Users: () => (
    <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  ),
  Clock: () => (
    <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Wallet: () => (
    <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  )
};

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

// Egyszerűsített státusz logika (színek tisztázása)
function computeTripStatus(trip: Trip) {
  if (!trip.date_from && !trip.date_to) {
    return { label: "Tervezés alatt", color: "bg-slate-100 text-slate-600" };
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  let start: Date | null = null;
  let end: Date | null = null;

  if (trip.date_from) start = new Date(trip.date_from);
  if (trip.date_to) end = new Date(trip.date_to);

  if (start && today < start) return { label: "Közelgő", color: "bg-blue-50 text-blue-600" };
  if (end && today > end) return { label: "Lezárult", color: "bg-slate-100 text-slate-500" };
  if ((start && today >= start) || (end && today <= end)) return { label: "Zajlik", color: "bg-emerald-50 text-[#16ba53] font-bold" };

  return { label: "Ismeretlen", color: "bg-slate-100 text-slate-600" };
}

function computeDurationDays(trip: Trip): number | null {
  if (!trip.date_from || !trip.date_to) return null;
  try {
    const start = new Date(trip.date_from);
    const end = new Date(trip.date_to);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 ? diffDays + 1 : null;
  } catch {
    return null;
  }
}

function formatDateLabel(value?: string | null): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" });
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
  const [localTrip, setLocalTrip] = useState<Trip>(trip);
  const [displayFrom, setDisplayFrom] = useState(from);
  const [displayTo, setDisplayTo] = useState(to);

  // Szerkesztés state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(trip.title ?? "");
  const [editDestination, setEditDestination] = useState(trip.destination ?? "");
  const [editDateFrom, setEditDateFrom] = useState(trip.date_from ? trip.date_from.slice(0, 10) : "");
  const [editDateTo, setEditDateTo] = useState(trip.date_to ? trip.date_to.slice(0, 10) : "");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
  const [totalsByCurrency, setTotalsByCurrency] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const { data: memberRows } = await supabase
          .from("trip_members")
          .select("*")
          .eq("trip_id", trip.id)
          .eq("status", "accepted");

        if (memberRows) setMembers(memberRows as TripMember[]);

        const { data: expenses } = await supabase
          .from("trip_expenses")
          .select("amount, currency")
          .eq("trip_id", trip.id);

        if (expenses) {
          const totals = (expenses as TripExpense[]).reduce<Record<string, number>>((acc, exp) => {
            const cur = (exp.currency || "EUR").toUpperCase();
            const amt = Number(exp.amount) || 0;
            acc[cur] = (acc[cur] || 0) + amt;
            return acc;
          }, {});
          setTotalsByCurrency(totals);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [trip.id]);

  const memberCount = members.length;
  const hasAnyStats = durationDays !== null || memberCount > 1 || Object.keys(totalsByCurrency).length > 0;

  // --- MENTÉS LOGIKA ---
  const handleSaveEdit = async (e: any) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!editTitle.trim()) { setEditError("Cím kötelező."); return; }
    if (!editDateFrom) { setEditError("Kezdő dátum kötelező."); return; }

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
        .select()
        .single();

      if (error || !data) throw new Error("Mentés sikertelen");

      const updated = data as Trip;
      setLocalTrip(updated);
      setDisplayFrom(formatDateLabel(updated.date_from));
      setDisplayTo(formatDateLabel(updated.date_to));
      setIsEditing(false);
    } catch (err) {
      setEditError("Hiba történt mentéskor.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-slate-100 mb-6">
      
      {/* 1. SOR: Cím, Státusz, Szerkesztés */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900 leading-tight">
              {localTrip.title}
            </h1>
            {isOwner && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-slate-400 hover:text-[#16ba53] hover:bg-green-50 rounded-full transition"
                title="Szerkesztés"
              >
                <Icons.Pencil />
              </button>
            )}
            <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider border ${status.color.replace("text-", "border-").replace("50", "100")} ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Infó sor (Helyszín + Dátum) */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {localTrip.destination && (
              <div className="flex items-center gap-1.5">
                <Icons.Pin />
                <span>{localTrip.destination}</span>
              </div>
            )}
            {(displayFrom || displayTo) && (
              <div className="flex items-center gap-1.5">
                <Icons.Calendar />
                <span>
                  {displayFrom} {displayFrom && displayTo && "➝"} {displayTo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* User Info (Jobb felső - diszkrét) */}
        {user && user.email && (
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
            <div className="w-6 h-6 rounded-full bg-[#16ba53] flex items-center justify-center text-xs font-bold text-white">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-slate-600 font-medium hidden sm:inline-block">
              {user.email}
            </span>
          </div>
        )}
      </div>

      {/* SZERKESZTŐ FORM (Lenyíló) */}
      {isOwner && isEditing && (
        <form onSubmit={handleSaveEdit} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cím</label>
              <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#16ba53] focus:border-transparent outline-none" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Helyszín</label>
              <DestinationAutocomplete value={editDestination} onChange={setEditDestination} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kezdés</label>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#16ba53] outline-none" value={editDateFrom} onChange={(e) => setEditDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vége</label>
              <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#16ba53] outline-none" value={editDateTo} onChange={(e) => setEditDateTo(e.target.value)} />
            </div>
          </div>
          {editError && <p className="text-xs text-red-600 mt-2">{editError}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => { setIsEditing(false); setEditError(null); }} className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Mégse</button>
            <button type="submit" disabled={savingEdit} className="px-4 py-1.5 text-xs font-medium text-white bg-[#16ba53] rounded-lg hover:opacity-90 disabled:opacity-70">{savingEdit ? "Mentés..." : "Mentés"}</button>
          </div>
        </form>
      )}

      {/* 2. SOR: Statisztikák (Badge-ek helyett letisztult sor) */}
      {hasAnyStats && !isEditing && (
        <div className="flex flex-wrap gap-3 mb-5 pt-3 border-t border-slate-50">
          {durationDays !== null && (
            <div className="flex items-center text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <Icons.Clock /> {durationDays} nap
            </div>
          )}
          {memberCount > 1 && (
            <div className="flex items-center text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <Icons.Users /> {memberCount} résztvevő
            </div>
          )}
          {Object.entries(totalsByCurrency).map(([cur, total]) => (
            <div key={cur} className="flex items-center text-xs text-slate-700 bg-emerald-50/50 px-2.5 py-1.5 rounded-lg border border-emerald-100/50">
              <Icons.Wallet />
              <span className="font-semibold mr-1">{total.toLocaleString("hu-HU", { maximumFractionDigits: 0 })}</span> {cur}
            </div>
          ))}
        </div>
      )}

      {/* 3. SOR: Akciógombok */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onScrollToExpenses}
          className="inline-flex items-center px-4 py-2 rounded-full bg-[#16ba53] text-white text-xs font-bold hover:opacity-90 transition shadow-sm hover:shadow"
        >
          <Icons.Plus /> Költség hozzáadása
        </button>

        <Link
          href={`/trip/${trip.id}/stats`}
          className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 hover:text-slate-800 transition"
        >
          Statisztika
        </Link>

        <Link
          href={`/trip/${trip.id}/invite`}
          className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 hover:text-slate-800 transition"
        >
          Meghívó
        </Link>

        <button disabled className="inline-flex items-center px-4 py-2 rounded-full bg-slate-50 text-slate-400 text-xs font-medium cursor-not-allowed border border-transparent">
          TripTerv
        </button>
      </div>
    </div>
  );
}