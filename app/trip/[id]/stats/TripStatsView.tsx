"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip, TripExpense, TripMember } from "../../../../lib/trip/types";

type TripStatsViewProps = {
  trip: Trip;
  currentUserId: string | null;
  currentUserDisplayName?: string | null;
};

type PeriodMode = "all" | "day";
type GroupMode = "category" | "currency" | "user";

// ==== DÁTUM HELPEREK ====

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
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

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString("hu-HU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function getMemberDisplayName(
  member: TripMember | undefined,
  userId: string | null | undefined,
  currentUserId: string | null,
  currentUserDisplayName?: string | null
): string {
  if (!userId) {
    return "Útitárs";
  }

  if (currentUserId && userId === currentUserId) {
    if (currentUserDisplayName && currentUserDisplayName.trim() !== "") {
      return `Te (${currentUserDisplayName})`;
    }
    return "Te";
  }

  const name =
    member?.display_name?.trim() ||
    member?.email?.trim() ||
    "Útitárs";

  return name;
}

// ==== KOMPONENS ====

export default function TripStatsView({
  trip,
  currentUserId,
  currentUserDisplayName,
}: TripStatsViewProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");

  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [minDate, setMinDate] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Költségek
        const { data: expData, error: expError } = await supabase
          .from("trip_expenses")
          .select(
            "id, trip_id, user_id, date, category, note, amount, currency, payment_method, created_at"
          )
          .eq("trip_id", trip.id)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });

        if (expError) {
          console.error("TRIP_STATS_EXPENSES_ERROR", expError);
          throw new Error("Nem sikerült betölteni a költségeket.");
        }

        const mappedExpenses: TripExpense[] = (expData || []).map(
          (e: any) => ({
            ...e,
            amount: Number(e.amount ?? 0),
            currency: e.currency ?? "EUR",
          })
        );

        // Útitársak
        const { data: memberData, error: memberError } = await supabase
          .from("trip_members")
          .select(
            "id, trip_id, user_id, role, status, display_name, email"
          )
          .eq("trip_id", trip.id)
          .eq("status", "accepted");

        if (memberError) {
          console.error("TRIP_STATS_MEMBERS_ERROR", memberError);
          // nem dobjuk tovább, csak log
        }

        if (cancelled) return;

        setExpenses(mappedExpenses);
        setMembers((memberData || []) as TripMember[]);

        if (mappedExpenses.length > 0) {
          const dates = mappedExpenses
            .map((e) => e.date)
            .filter(Boolean) as string[];

          if (dates.length > 0) {
            const sorted = [...dates].sort();
            setMinDate(sorted[0]);
            setMaxDate(sorted[sorted.length - 1]);

            // ha még nincs kiválasztott nap, legyen a legelső vagy ma, ha esik rá adat
            if (!selectedDate) {
              const today = todayIso();
              if (dates.includes(today)) {
                setSelectedDate(today);
              } else {
                setSelectedDate(sorted[0]);
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
            e?.message ??
              "Váratlan hiba történt a statisztikák betöltésekor."
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
  }, [trip.id]);

  // ---- SZŰRT KÖLTSÉGEK IDŐSZAK ALAPJÁN ----

  const filteredExpenses = useMemo(() => {
    if (periodMode === "all") return expenses;
    if (!selectedDate) return [];
    return expenses.filter((exp) => exp.date === selectedDate);
  }, [periodMode, selectedDate, expenses]);

  const hasAnyData = filteredExpenses.length > 0;

  // ---- ÖSSZESÍTÉS PÉNZNEMENKÉNT -> badge-ek + normalizáláshoz ----

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

  // ---- KATEGÓRIA × PÉNZNEM BONTÁS ----

  type CategoryRow = {
    category: string;
    byCurrency: { currency: string; amount: number }[];
  };

  const categoryRows: CategoryRow[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const exp of filteredExpenses) {
      const category = exp.category?.trim() || "Egyéb";
      const currency = (exp.currency || "EUR").toUpperCase();
      const amt = Number(exp.amount || 0);

      if (!map.has(category)) {
        map.set(category, new Map());
      }
      const curMap = map.get(category)!;
      curMap.set(currency, (curMap.get(currency) || 0) + amt);
    }

    const rows: CategoryRow[] = Array.from(map.entries()).map(
      ([category, curMap]) => ({
        category,
        byCurrency: Array.from(curMap.entries()).map(
          ([currency, amount]) => ({
            currency,
            amount,
          })
        ),
      })
    );

    // rendezzük a kategóriákat az összegük alapján
    rows.sort((a, b) => {
      const sumA = a.byCurrency.reduce((s, x) => s + x.amount, 0);
      const sumB = b.byCurrency.reduce((s, x) => s + x.amount, 0);
      return sumB - sumA;
    });

    return rows;
  }, [filteredExpenses]);

  // minden pénznemhez max kategória-összeg (progress bar normalizálás)
  const maxAmountPerCurrency = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of categoryRows) {
      for (const item of row.byCurrency) {
        const prev = map.get(item.currency) || 0;
        map.set(item.currency, Math.max(prev, item.amount));
      }
    }

    return map;
  }, [categoryRows]);

  // ---- PÉNZNEM × FIZETÉSI MÓD BONTÁS ----

  type CurrencyPaymentRow = {
    currency: string;
    total: number;
    byMethod: { method: string; amount: number }[];
  };

  const currencyPaymentRows: CurrencyPaymentRow[] = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const exp of filteredExpenses) {
      const currency = (exp.currency || "EUR").toUpperCase();
      const method = exp.payment_method?.trim() || "Egyéb";
      const amt = Number(exp.amount || 0);

      if (!map.has(currency)) {
        map.set(currency, new Map());
      }
      const methodMap = map.get(currency)!;
      methodMap.set(method, (methodMap.get(method) || 0) + amt);
    }

    const rows: CurrencyPaymentRow[] = Array.from(map.entries()).map(
      ([currency, methodMap]) => {
        const byMethod = Array.from(methodMap.entries()).map(
          ([method, amount]) => ({
            method,
            amount,
          })
        );
        const total = byMethod.reduce((s, x) => s + x.amount, 0);
        return { currency, total, byMethod };
      }
    );

    // pénznemek rendezése összes szerint
    rows.sort((a, b) => b.total - a.total);

    return rows;
  }, [filteredExpenses]);

  // ---- RÉSZLETES: RÉSZTVEVŐ → PÉNZNEM × KATEGÓRIA ----

  type UserRow = {
    userId: string;
    name: string;
    totalsByCurrency: Record<string, number>;
    byCategoryCurrency: {
      currency: string;
      category: string;
      amount: number;
    }[];
  };

  const detailedUserRows: UserRow[] = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        items: { currency: string; category: string; amount: number }[];
      }
    >();

    for (const exp of filteredExpenses) {
      const userId = exp.user_id;
      const member = members.find((m) => m.user_id === userId);

      const name = getMemberDisplayName(
        member,
        userId,
        currentUserId,
        currentUserDisplayName
      );

      const currency = (exp.currency || "EUR").toUpperCase();
      const category = exp.category?.trim() || "Egyéb";
      const amount = Number(exp.amount || 0);

      if (!map.has(userId)) {
        map.set(userId, { name, items: [] });
      }
      map.get(userId)!.items.push({ currency, category, amount });
    }

    const rows: UserRow[] = [];

    for (const [userId, { name, items }] of map.entries()) {
      const totalsByCurrency: Record<string, number> = {};
      const agg: Record<string, { currency: string; category: string; amount: number }> =
        {};

      for (const item of items) {
        totalsByCurrency[item.currency] =
          (totalsByCurrency[item.currency] || 0) + item.amount;

        const key = `${item.currency}__${item.category}`;
        if (!agg[key]) {
          agg[key] = {
            currency: item.currency,
            category: item.category,
            amount: 0,
          };
        }
        agg[key].amount += item.amount;
      }

      const byCategoryCurrency = Object.values(agg).sort(
        (a, b) => b.amount - a.amount
      );

      rows.push({
        userId,
        name,
        totalsByCurrency,
        byCategoryCurrency,
      });
    }

    // rendezés a felhasználók összes költése szerint
    rows.sort((a, b) => {
      const sumA = Object.values(a.totalsByCurrency).reduce(
        (s, x) => s + x,
        0
      );
      const sumB = Object.values(b.totalsByCurrency).reduce(
        (s, x) => s + x,
        0
      );
      return sumB - sumA;
    });

    return rows;
  }, [filteredExpenses, members, currentUserId, currentUserDisplayName]);

  const maxCurrencyAmount =
    Object.keys(totalsByCurrency).length > 0
      ? Math.max(...Object.values(totalsByCurrency))
      : 0;

  const maxUserTotal =
    detailedUserRows.length > 0
      ? Math.max(
          ...detailedUserRows.map((u) =>
            Object.values(u.totalsByCurrency).reduce(
              (sum, v) => sum + v,
              0
            )
          )
        )
      : 0;

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

  // ==== RENDER ==== //

  return (
    <section className="bg-white rounded-2xl shadow-md p-4 md:p-6 border border-slate-100">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Költség statisztika
          </h2>
          <p className="text-[11px] text-slate-500">
            Áttekintés az ehhez az utazáshoz rögzített költségekről.
          </p>
        </div>
      </div>

      {/* Időszak választó */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
              disabled={!selectedDate || (minDate && selectedDate <= minDate)}
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ◀
            </button>
            <input
              type="date"
              className="rounded-full border border-slate-200 px-3 py-1 outline-none text-[11px] focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={selectedDate ?? ""}
              onChange={(e) =>
                setSelectedDate(e.target.value || null)
              }
              min={minDate ?? undefined}
              max={maxDate ?? undefined}
            />
            <button
              type="button"
              onClick={handleNextDay}
              disabled={!selectedDate || (maxDate && selectedDate >= maxDate)}
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Csoportosítás mód választó */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] text-slate-500">
          Nézet:
        </span>
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

      {/* Összesítő badge-ek – TripHeader stílusban */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(totalsByCurrency).length > 0 ? (
          Object.entries(totalsByCurrency).map(([cur, amt]) => (
            <span
              key={cur}
              className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-[11px] text-emerald-700"
            >
              {cur} összesen:{" "}
              <span className="ml-1 font-semibold">
                {formatCurrency(amt, cur)}
              </span>
            </span>
          ))
        ) : (
          <span className="text-[11px] text-slate-400">
            Még nincs elég adat az összesítéshez.
          </span>
        )}
      </div>

      {/* Törzs tartalom */}
      {loading ? (
        <p className="text-[12px] text-slate-500">
          Statisztikák betöltése...
        </p>
      ) : !hasAnyData ? (
        <p className="text-[12px] text-slate-500">
          Erre az időszakra még nincs rögzített költség.
        </p>
      ) : (
        <>
          {/* Kategória × Pénznem */}
          {groupMode === "category" && (
            <div className="space-y-4">
              {categoryRows.map((row) => (
                <div
                  key={row.category}
                  className="border border-slate-100 rounded-2xl p-3 bg-slate-50/60"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-900">
                      {row.category}
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      {row.byCurrency
                        .map((c) =>
                          formatCurrency(c.amount, c.currency)
                        )
                        .join(" • ")}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {row.byCurrency.map((item) => {
                      const maxCur = maxAmountPerCurrency.get(
                        item.currency
                      );
                      const ratio =
                        maxCur && maxCur > 0
                          ? (item.amount / maxCur) * 100
                          : 0;
                      const width = Math.max(8, ratio);

                      return (
                        <div key={item.currency}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-600">
                              {item.currency}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                item.amount,
                                item.currency
                              )}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-[#16ba53] rounded-full"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pénznem × Fizetési mód */}
          {groupMode === "currency" && (
            <div className="space-y-4">
              {currencyPaymentRows.map((row) => (
                <div
                  key={row.currency}
                  className="border border-slate-100 rounded-2xl p-3 bg-slate-50/60"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-900">
                      {row.currency}
                    </h3>
                    <span className="text-[11px] text-slate-600">
                      {formatCurrency(row.total, row.currency)}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#16ba53] rounded-full"
                        style={{
                          width:
                            maxCurrencyAmount > 0
                              ? `${Math.max(
                                  8,
                                  (row.total / maxCurrencyAmount) * 100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    {row.byMethod.map((item) => (
                      <div
                        key={item.method}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-600">
                          {item.method}
                        </span>
                        <span className="text-slate-700">
                          {formatCurrency(
                            item.amount,
                            row.currency
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Részletes: Útitársak szerint */}
          {groupMode === "user" && (
            <div className="space-y-4">
              {detailedUserRows.map((user) => {
                const total = Object.values(
                  user.totalsByCurrency
                ).reduce((s, x) => s + x, 0);
                const ratio =
                  maxUserTotal > 0
                    ? (total / maxUserTotal) * 100
                    : 0;
                const width = Math.max(8, ratio);

                return (
                  <div
                    key={user.userId}
                    className="border border-slate-100 rounded-2xl p-3 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-900">
                          {user.name}
                        </h3>
                        <p className="text-[10px] text-slate-500">
                          {Object.entries(user.totalsByCurrency)
                            .map(([cur, amt]) =>
                              formatCurrency(amt, cur)
                            )
                            .join(" • ")}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-700 font-medium">
                        {formatCurrency(total, "")}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#16ba53] rounded-full"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      {user.byCategoryCurrency.map((item) => (
                        <div
                          key={`${item.category}-${item.currency}`}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-600">
                            {item.category} ({item.currency})
                          </span>
                          <span className="text-slate-700">
                            {formatCurrency(
                              item.amount,
                              item.currency
                            )}
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

      {groupCount === 0 && hasAnyData && (
        <p className="mt-3 text-[11px] text-slate-500">
          Ehhez a nézethez még nincs elegendő adat.
        </p>
      )}

      {periodMode === "all" && (
        <p className="mt-4 text-[10px] text-slate-400">
          Az &quot;Utazáshoz rögzítve&quot; nézet minden ehhez az
          utazáshoz felvitt költést tartalmaz, függetlenül attól,
          hogy ténylegesen mikor fizetted ki őket (pl. előre
          kifizetett szállás).
        </p>
      )}
    </section>
  );
}
