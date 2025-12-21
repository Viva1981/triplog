"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip, TripExpense, TripMember } from "../../../../lib/trip/types";

// --- BECSÜLT ÁRFOLYAMOK A VIZUÁLIS MEGJELENÍTÉSHEZ ---
// Ez csak a csíkok hosszát befolyásolja, a kiírt összegeket NEM!
// Bázis: HUF
const ESTIMATED_RATES: Record<string, number> = {
  HUF: 1,
  EUR: 400,
  USD: 380,
  GBP: 480,
  CHF: 430,
  PLN: 95,
  CZK: 16,
  RON: 80,
  HRK: 53,
  RSD: 3.4,
};

// Segédfüggvény: Érték normalizálása HUF-ra
function getNormalizedValue(amount: number, currency: string): number {
  const rate = ESTIMATED_RATES[currency.toUpperCase()] || 1; // Ha ismeretlen, 1:1
  return amount * rate;
}

type TripStatsViewProps = {
  trip: Trip;
  currentUserId: string | null;
  currentUserDisplayName?: string | null;
};

type PeriodMode = "all" | "day";
type GroupMode = "category" | "currency" | "user";

type CategoryRow = {
  category: string;
  byCurrency: { currency: string; amount: number }[];
};

type CurrencyPaymentRow = {
  currency: string;
  total: number;
  byMethod: { method: string; amount: number }[];
};

type DetailedUserRow = {
  userId: string;
  label: string;
  totalsByCurrency: Record<string, number>;
  byCategoryCurrency: {
    currency: string;
    category: string;
    amount: number;
  }[];
};

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number, currency?: string | null): string {
  const formatted = amount.toLocaleString("hu-HU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

function getMemberDisplayName(
  member: TripMember | undefined,
  userId: string,
  currentUserId: string | null,
  currentUserDisplayName?: string | null
): string {
  if (currentUserId && userId === currentUserId) {
    if (currentUserDisplayName && currentUserDisplayName.trim() !== "") {
      return `Te (${currentUserDisplayName})`;
    }
    return "Te";
  }

  const base =
    member?.display_name?.trim() ||
    member?.email?.trim() ||
    "Útitárs";

  return base.startsWith("Útitárs") ? base : `Útitárs (${base})`;
}

export default function TripStatsView({
  trip,
  currentUserId,
  currentUserDisplayName,
}: TripStatsViewProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [minDate, setMinDate] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [{ data: expData, error: expError }, { data: memberData, error: memberError }] =
          await Promise.all([
            supabase
              .from("trip_expenses")
              .select(
                "id, trip_id, user_id, date, category, note, amount, currency, payment_method, created_at"
              )
              .eq("trip_id", trip.id)
              .order("date", { ascending: true })
              .order("created_at", { ascending: true }),
            supabase
              .from("trip_members")
              .select("id, trip_id, user_id, role, status, display_name, email")
              .eq("trip_id", trip.id)
              .eq("status", "accepted"),
          ]);

        if (expError) {
          console.error("TRIP_STATS_EXPENSES_ERROR", expError);
          throw new Error("Nem sikerült betölteni a költségeket.");
        }

        const mappedExpenses: TripExpense[] = (expData || []).map((e: any) => ({
          ...e,
          amount: Number(e.amount ?? 0),
        }));

        if (cancelled) return;

        setExpenses(mappedExpenses);
        setMembers((memberData || []) as TripMember[]);

        if (mappedExpenses.length > 0) {
          const dates = mappedExpenses
            .map((e) => e.date)
            .filter(Boolean) as string[];

          if (dates.length > 0) {
            const sorted = [...dates].sort();
            const min = sorted[0];
            const max = sorted[sorted.length - 1];
            setMinDate(min);
            setMaxDate(max);

            if (!selectedDate) {
              const today = todayIso();
              if (dates.includes(today)) {
                setSelectedDate(today);
              } else {
                setSelectedDate(min);
              }
            }
          }
        } else {
          setMinDate(null);
          setMaxDate(null);
          setSelectedDate(null);
        }
      } catch (e: any) {
        console.error("TRIP_STATS_ERROR", e);
        if (!cancelled) {
          setError(
            e?.message ?? "Váratlan hiba történt a statisztikák betöltésekor."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // --- Szűrt költségek az időszak alapján ---

  const filteredExpenses = useMemo(() => {
    if (periodMode === "day" && selectedDate) {
      return expenses.filter((exp) => exp.date === selectedDate);
    }
    return expenses;
  }, [periodMode, selectedDate, expenses]);

  const hasAnyData = filteredExpenses.length > 0;

  // --- Összes költés pénznemenként (badge-ekhez) ---

  const totalsByCurrency = useMemo(
    () =>
      filteredExpenses.reduce<Record<string, number>>((acc, exp) => {
        const cur = (exp.currency || "EUR").toUpperCase();
        const amt = Number(exp.amount || 0);
        acc[cur] = (acc[cur] || 0) + amt;
        return acc;
      }, {}),
    [filteredExpenses]
  );

  // --- Kategóriák × Pénznem ---

  const categoryRows: CategoryRow[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const exp of filteredExpenses) {
      const category =
        exp.category && exp.category.trim() !== ""
          ? exp.category.trim()
          : "Egyéb";
      const currency = (exp.currency || "EUR").toUpperCase();
      const amount = Number(exp.amount || 0);

      if (!map.has(category)) {
        map.set(category, new Map());
      }
      const curMap = map.get(category)!;
      curMap.set(currency, (curMap.get(currency) || 0) + amount);
    }

    const rows: CategoryRow[] = [];

    for (const [category, curMap] of map.entries()) {
      const byCurrency = Array.from(curMap.entries()).map(([currency, amount]) => ({
        currency,
        amount,
      }));

      // Belső rendezés: a legnagyobb ÉRTÉKŰ legyen elöl (normalizálva)
      byCurrency.sort((a, b) => 
        getNormalizedValue(b.amount, b.currency) - getNormalizedValue(a.amount, a.currency)
      );

      rows.push({ category, byCurrency });
    }

    // Kategóriák rendezése: a legnagyobb összértékű legyen felül (normalizálva)
    rows.sort((a, b) => {
      const sumA = a.byCurrency.reduce((s, x) => s + getNormalizedValue(x.amount, x.currency), 0);
      const sumB = b.byCurrency.reduce((s, x) => s + getNormalizedValue(x.amount, x.currency), 0);
      return sumB - sumA;
    });

    return rows;
  }, [filteredExpenses]);

  // --- GLOBÁLIS MAXIMUM (Kategória nézethez) ---
  // Megkeressük a legdrágább tételt (bármilyen pénznemben), hogy ahhoz igazítsuk a csíkokat
  const globalMaxCategoryValue = useMemo(() => {
    let max = 0;
    for (const row of categoryRows) {
      for (const item of row.byCurrency) {
        const val = getNormalizedValue(item.amount, item.currency);
        if (val > max) max = val;
      }
    }
    return max;
  }, [categoryRows]);


  // --- Pénznemek × Fizetési mód ---

  const currencyPaymentRows: CurrencyPaymentRow[] = useMemo(() => {
    const map = new Map<string, { total: number; byMethod: Map<string, number> }>();

    for (const exp of filteredExpenses) {
      const currency = (exp.currency || "EUR").toUpperCase();
      const method = exp.payment_method?.trim() || "Egyéb";
      const amount = Number(exp.amount || 0);

      if (!map.has(currency)) {
        map.set(currency, { total: 0, byMethod: new Map() });
      }

      const entry = map.get(currency)!;
      entry.total += amount;
      entry.byMethod.set(method, (entry.byMethod.get(method) || 0) + amount);
    }

    const rows: CurrencyPaymentRow[] = [];

    for (const [currency, { total, byMethod }] of map.entries()) {
      const byMethodArr = Array.from(byMethod.entries()).map(([method, amount]) => ({
        method,
        amount,
      }));
      byMethodArr.sort((a, b) => b.amount - a.amount);
      rows.push({ currency, total, byMethod: byMethodArr });
    }

    // Rendezés a normalizált összérték szerint
    rows.sort((a, b) => 
      getNormalizedValue(b.total, b.currency) - getNormalizedValue(a.total, a.currency)
    );

    return rows;
  }, [filteredExpenses]);

  // Max érték a csíkokhoz (normalizálva)
  const maxCurrencyTotalNormalized = useMemo(() => {
    if (currencyPaymentRows.length === 0) return 0;
    return Math.max(...currencyPaymentRows.map(r => getNormalizedValue(r.total, r.currency)));
  }, [currencyPaymentRows]);


  // --- Részletes: Útitárs → pénznem × kategória ---

  const detailedUserRows: DetailedUserRow[] = useMemo(() => {
    const map = new Map<string, DetailedUserRow>();

    for (const exp of filteredExpenses) {
      const rawUserId = exp.user_id ?? "unknown";
      const userId = rawUserId || "unknown";

      const member = members.find((m) => m.user_id === userId);

      const currency = (exp.currency || "EUR").toUpperCase();
      const category =
        exp.category && exp.category.trim() !== ""
          ? exp.category.trim()
          : "Egyéb";
      const amount = Number(exp.amount || 0);

      const existing = map.get(userId);
      if (!existing) {
        const label = getMemberDisplayName(
          member,
          userId,
          currentUserId,
          currentUserDisplayName
        );
        map.set(userId, {
          userId,
          label,
          totalsByCurrency: { [currency]: amount },
          byCategoryCurrency: [{ currency, category, amount }],
        });
      } else {
        existing.totalsByCurrency[currency] =
          (existing.totalsByCurrency[currency] || 0) + amount;

        const keyIndex = existing.byCategoryCurrency.findIndex(
          (x) => x.currency === currency && x.category === category
        );
        if (keyIndex === -1) {
          existing.byCategoryCurrency.push({ currency, category, amount });
        } else {
          existing.byCategoryCurrency[keyIndex].amount += amount;
        }
      }
    }

    const rows = Array.from(map.values());

    for (const row of rows) {
      // Rendezés értéke szerint
      row.byCategoryCurrency.sort((a, b) => 
        getNormalizedValue(b.amount, b.currency) - getNormalizedValue(a.amount, a.currency)
      );
    }

    // User sorrend normalizált összérték szerint
    rows.sort((a, b) => {
      const sumA = Object.entries(a.totalsByCurrency).reduce((s, [c, v]) => s + getNormalizedValue(v, c), 0);
      const sumB = Object.entries(b.totalsByCurrency).reduce((s, [c, v]) => s + getNormalizedValue(v, c), 0);
      return sumB - sumA;
    });

    return rows;
  }, [filteredExpenses, members, currentUserId, currentUserDisplayName]);

  // Max user költés (normalizálva)
  const maxUserTotalNormalized = useMemo(() => {
    if (detailedUserRows.length === 0) return 0;
    return Math.max(
      ...detailedUserRows.map((u) =>
        Object.entries(u.totalsByCurrency).reduce((sum, [c, v]) => sum + getNormalizedValue(v, c), 0)
      )
    );
  }, [detailedUserRows]);


  const groupCount =
    groupMode === "category"
      ? categoryRows.length
      : groupMode === "currency"
      ? currencyPaymentRows.length
      : detailedUserRows.length;

  const handlePrevDay = () => {
    if (!selectedDate) return;
    if (minDate && selectedDate <= minDate) return;
    setSelectedDate(shiftDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (!selectedDate) return;
    if (maxDate && selectedDate >= maxDate) return;
    setSelectedDate(shiftDate(selectedDate, 1));
  };

  // --- RENDER ---

  if (loading) {
    return (
      <section className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
        <p className="text-[11px] text-slate-500">Statisztikák betöltése...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100">
      {/* Fejléc */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Költség statisztika
          </h2>
          <p className="text-[11px] text-slate-500">
            Áttekintés az ehhez az utazáshoz rögzített költségekről.
          </p>
        </div>

        {periodMode === "day" && selectedDate && (
          <p className="text-[10px] text-slate-500">
            Kiválasztott nap:{" "}
            <span className="font-medium">{formatDateDisplay(selectedDate)}</span>
          </p>
        )}
      </div>

      {/* Időtartam választó */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-1 bg-slate-50 rounded-full p-1">
          <button
            type="button"
            onClick={() => setPeriodMode("all")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              periodMode === "all"
                ? "bg-[#16ba53] text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            Utazáshoz rögzítve
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode("day")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              periodMode === "day"
                ? "bg-[#16ba53] text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            Megadott nap
          </button>
        </div>

        {periodMode === "day" && (
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={
                !selectedDate ||
                (!!minDate && !!selectedDate && selectedDate <= minDate)
              }
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ◀
            </button>
            <input
              type="date"
              className="rounded-full border border-slate-200 px-3 py-1 outline-none text-[11px] focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] min-w-[140px]"
              value={selectedDate ?? ""}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              min={minDate ?? undefined}
              max={maxDate ?? undefined}
            />
            <button
              type="button"
              onClick={handleNextDay}
              disabled={
                !selectedDate ||
                (!!maxDate && !!selectedDate && selectedDate >= maxDate)
              }
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Nézet választó */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] text-slate-500">Nézet:</span>
        <div className="inline-flex bg-slate-50 rounded-full p-1">
          <button
            type="button"
            onClick={() => setGroupMode("category")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              groupMode === "category"
                ? "bg-white text-[#16ba53] shadow-sm"
                : "text-slate-600"
            }`}
          >
            Kategóriák
          </button>
          <button
            type="button"
            onClick={() => setGroupMode("currency")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              groupMode === "currency"
                ? "bg-white text-[#16ba53] shadow-sm"
                : "text-slate-600"
            }`}
          >
            Pénznemek
          </button>
          <button
            type="button"
            onClick={() => setGroupMode("user")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              groupMode === "user"
                ? "bg-white text-[#16ba53] shadow-sm"
                : "text-slate-600"
            }`}
          >
            Részletes
          </button>
        </div>
      </div>

      {/* Összesítő badge-ek */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(totalsByCurrency).length > 0 ? (
          Object.entries(totalsByCurrency).map(([cur, amt]) => (
            <span
              key={cur}
              className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-[11px] text-emerald-700"
            >
              {cur} összesen:{" "}
              <span className="ml-1 font-semibold">{formatAmount(amt, cur)}</span>
            </span>
          ))
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600">
            Még nincs elég adat az összesítéshez.
          </span>
        )}

        {groupMode !== "user" && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700">
            {groupMode === "category" && "Kategóriák száma:"}
            {groupMode === "currency" && "Pénznemek száma:"}{" "}
            <span className="font-semibold ml-1">{groupCount}</span>
          </span>
        )}

        {groupMode === "user" && groupCount > 1 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700">
            Költést rögzített:{" "}
            <span className="font-semibold ml-1">{groupCount} fő</span>
          </span>
        )}
      </div>

      {!hasAnyData ? (
        <p className="text-[11px] text-slate-500">
          Még nincs rögzített költség ehhez az utazáshoz a kiválasztott időszakban.
        </p>
      ) : (
        <>
          {/* --- KATEGÓRIA NÉZET --- */}
          {groupMode === "category" && (
            <div className="space-y-3">
              {categoryRows.map((row) => (
                <div
                  key={row.category}
                  className="border border-slate-100 rounded-2xl px-3 py-2 bg-slate-50/60"
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-[12px] font-semibold text-slate-900">
                      {row.category}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {row.byCurrency
                        .map((x) => formatAmount(x.amount, x.currency))
                        .join(" • ")}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {row.byCurrency.map((item) => {
                      // ITT A VÁLTOZTATÁS:
                      // Nem a pénznemen belüli maxhoz, hanem a GLOBÁLIS maxhoz mérünk
                      const valNorm = getNormalizedValue(item.amount, item.currency);
                      const ratio = globalMaxCategoryValue > 0 ? (valNorm / globalMaxCategoryValue) * 100 : 0;
                      const width = Math.max(8, ratio);

                      return (
                        <div key={item.currency}>
                          <div className="flex items-center justify-between text-[11px] mb-0.5">
                            <span className="text-slate-600">{item.currency}</span>
                            <span className="font-medium">
                              {formatAmount(item.amount, item.currency)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-[#16ba53] rounded-full transition-all duration-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <p className="mt-2 text-[10px] text-slate-400">
                A csíkok hossza becsült árfolyamon átszámolva arányos (pl. 1 EUR ≈ 400 HUF).
              </p>
            </div>
          )}

          {/* --- PÉNZNEM NÉZET --- */}
          {groupMode === "currency" && (
            <div className="space-y-3">
              {currencyPaymentRows.map((row) => {
                // ITT IS: Normalizált érték alapján számoljuk a szélességet
                const valNorm = getNormalizedValue(row.total, row.currency);
                const ratio =
                  maxCurrencyTotalNormalized > 0 ? (valNorm / maxCurrencyTotalNormalized) * 100 : 0;
                const width = Math.max(8, ratio);

                return (
                  <div
                    key={row.currency}
                    className="border border-slate-100 rounded-2xl px-3 py-2 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-[12px] font-semibold text-slate-900">
                        {row.currency}
                      </span>
                      <span className="text-[11px] text-slate-700 font-medium">
                        {formatAmount(row.total, row.currency)}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-2 bg-[#16ba53] rounded-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="space-y-1">
                      {row.byMethod.map((item) => (
                        <div
                          key={item.method}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-600">{item.method}</span>
                          <span className="text-slate-700">
                            {formatAmount(item.amount, row.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <p className="mt-2 text-[10px] text-slate-400">
                Itt pénznemenként összesítjük a költéseket.
              </p>
            </div>
          )}

          {/* --- RÉSZLETES (USER) NÉZET --- */}
          {groupMode === "user" && (
            <div className="space-y-3">
              {detailedUserRows.map((row) => {
                // Összes költés normalizálva
                const totalNorm = Object.entries(row.totalsByCurrency).reduce(
                  (sum, [c, v]) => sum + getNormalizedValue(v, c),
                  0
                );

                const ratio =
                  maxUserTotalNormalized > 0 ? (totalNorm / maxUserTotalNormalized) * 100 : 0;
                const width = Math.max(8, ratio);

                const totalSummary = Object.entries(row.totalsByCurrency)
                  .map(([cur, amt]) => formatAmount(amt, cur))
                  .join(" • ");

                return (
                  <div
                    key={row.userId}
                    className="border border-slate-100 rounded-2xl px-3 py-2 bg-slate-50/60"
                  >
                    <div className="mb-1">
                      <p className="text-[12px] font-semibold text-slate-900">
                        {row.label}
                      </p>
                      <p className="text-[10px] text-slate-500">{totalSummary}</p>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-2 bg-[#16ba53] rounded-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="space-y-1">
                      {row.byCategoryCurrency.map((item) => (
                        <div
                          key={`${item.category}-${item.currency}`}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-600">
                            {item.category} ({item.currency})
                          </span>
                          <span className="text-slate-700">
                            {formatAmount(item.amount, item.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {periodMode === "all" && (
        <p className="mt-4 text-[10px] text-slate-400">
          Az &quot;Utazáshoz rögzítve&quot; nézet minden ehhez az utazáshoz felvitt költést
          tartalmaz.
        </p>
      )}
    </section>
  );
}