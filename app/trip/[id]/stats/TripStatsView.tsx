"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip, TripExpense } from "../../../../lib/trip/types";

type TripStatsViewProps = {
  trip: Trip;
  currentUserId: string | null;
  currentUserDisplayName?: string | null;
};

type PeriodMode = "all" | "day";
type GroupMode = "category" | "currency" | "user";

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
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

type DetailedUserRow = {
  userId: string | null;
  label: string;
  totalsByCurrency: Record<string, number>;
  categoriesByCurrency: Record<string, Record<string, number>>;
};

export default function TripStatsView({
  trip,
  currentUserId,
  currentUserDisplayName,
}: TripStatsViewProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("trip_expenses")
          .select(
            "id, trip_id, user_id, date, category, amount, currency, payment_method"
          )
          .eq("trip_id", trip.id)
          .order("date", { ascending: true });

        if (error) {
          console.error("Error loading expenses for stats page", error);
          setError("Hiba történt a statisztikák betöltésekor.");
        } else if (data) {
          const mapped = (data as any[]).map((e) => ({
            ...e,
            amount: Number(e.amount),
          })) as TripExpense[];
          setExpenses(mapped);

          if (!selectedDate) {
            if (mapped.length > 0) {
              setSelectedDate(mapped[mapped.length - 1].date); // legutóbbi nap
            } else if (trip.date_from) {
              setSelectedDate(trip.date_from);
            } else {
              setSelectedDate(todayIso());
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError("Váratlan hiba történt a statisztikák betöltésekor.");
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  const filteredExpenses = useMemo(() => {
    if (periodMode === "day" && selectedDate) {
      return expenses.filter((exp) => exp.date === selectedDate);
    }
    return expenses;
  }, [periodMode, selectedDate, expenses]);

  const totalsByCurrency = useMemo(
    () =>
      filteredExpenses.reduce<Record<string, number>>((acc, exp) => {
        const cur = exp.currency || "EUR";
        acc[cur] = (acc[cur] || 0) + (exp.amount || 0);
        return acc;
      }, {}),
    [filteredExpenses]
  );

  // --- Aggregációk ---

  const categoryRows = useMemo(() => {
    const map: Record<string, { amount: number; currency: string }> = {};
    for (const exp of filteredExpenses) {
      const key =
        exp.category && exp.category.trim() !== ""
          ? exp.category.trim()
          : "Egyéb";
      const cur = exp.currency || "EUR";
      if (!map[key]) {
        map[key] = { amount: 0, currency: cur };
      }
      map[key].amount += exp.amount || 0;
    }
    return Object.entries(map).map(([category, v]) => ({
      category,
      amount: v.amount,
      currency: v.currency,
    }));
  }, [filteredExpenses]);

  const currencyRows = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of filteredExpenses) {
      const cur = exp.currency || "EUR";
      map[cur] = (map[cur] || 0) + (exp.amount || 0);
    }
    return Object.entries(map).map(([currency, amount]) => ({
      currency,
      amount,
    }));
  }, [filteredExpenses]);

  const detailedUserRows: DetailedUserRow[] = useMemo(() => {
    const map = new Map<string, DetailedUserRow>();

    for (const exp of filteredExpenses) {
      const userId = exp.user_id ?? "unknown";
      const cur = exp.currency || "EUR";
      const category =
        exp.category && exp.category.trim() !== ""
          ? exp.category.trim()
          : "Egyéb";
      const amount = exp.amount || 0;

      const isCurrent = currentUserId && userId === currentUserId;

      const existing = map.get(userId);
      if (!existing) {
        const label = isCurrent
          ? currentUserDisplayName
            ? `Te (${currentUserDisplayName})`
            : "Te"
          : "Másik utazó";

        map.set(userId, {
          userId,
          label,
          totalsByCurrency: { [cur]: amount },
          categoriesByCurrency: { [cur]: { [category]: amount } },
        });
      } else {
        // total by currency
        existing.totalsByCurrency[cur] =
          (existing.totalsByCurrency[cur] || 0) + amount;

        // category by currency
        if (!existing.categoriesByCurrency[cur]) {
          existing.categoriesByCurrency[cur] = {};
        }
        existing.categoriesByCurrency[cur][category] =
          (existing.categoriesByCurrency[cur][category] || 0) + amount;
      }
    }

    // rendezés: aki a legtöbbet költötte, az legyen felül
    return Array.from(map.values()).sort((a, b) => {
      const totalA = Object.values(a.totalsByCurrency).reduce(
        (sum, v) => sum + v,
        0
      );
      const totalB = Object.values(b.totalsByCurrency).reduce(
        (sum, v) => sum + v,
        0
      );
      return totalB - totalA;
    });
  }, [filteredExpenses, currentUserId, currentUserDisplayName]);

  const maxCategoryAmount =
    categoryRows.length > 0
      ? Math.max(...categoryRows.map((c) => c.amount))
      : 0;

  const maxCurrencyAmount =
    currencyRows.length > 0
      ? Math.max(...currencyRows.map((c) => c.amount))
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

  const hasAnyData = filteredExpenses.length > 0;

  const groupCount =
    groupMode === "category"
      ? categoryRows.length
      : groupMode === "currency"
      ? currencyRows.length
      : detailedUserRows.length;

  const handlePrevDay = () => {
    if (!selectedDate) return;
    setSelectedDate(shiftDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    if (!selectedDate) return;
    setSelectedDate(shiftDate(selectedDate, 1));
  };

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
      {/* Időtartam választó */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="inline-flex items-center bg-slate-100 rounded-full p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setPeriodMode("all")}
            className={`px-3 py-1 rounded-full ${
              periodMode === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Utazáshoz rögzítve
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode("day")}
            className={`px-3 py-1 rounded-full ${
              periodMode === "day"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
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
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              ← Előző nap
            </button>
            <input
              type="date"
              className="text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={selectedDate ?? ""}
              onChange={(e) => setSelectedDate(e.target.value || null)}
            />
            <button
              type="button"
              onClick={handleNextDay}
              className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Következő nap →
            </button>
          </div>
        )}
      </div>

      {/* Dimenzió választó */}
      <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
        <button
          type="button"
          onClick={() => setGroupMode("category")}
          className={`px-3 py-1 rounded-full border ${
            groupMode === "category"
              ? "border-[#16ba53] bg-[#16ba53]/10 text-[#16ba53]"
              : "border-slate-200 text-slate-600"
          }`}
        >
          Kategóriák
        </button>
        <button
          type="button"
          onClick={() => setGroupMode("currency")}
          className={`px-3 py-1 rounded-full border ${
            groupMode === "currency"
              ? "border-[#16ba53] bg-[#16ba53]/10 text-[#16ba53]"
              : "border-slate-200 text-slate-600"
          }`}
        >
          Pénznemek
        </button>
        <button
          type="button"
          onClick={() => setGroupMode("user")}
          className={`px-3 py-1 rounded-full border ${
            groupMode === "user"
              ? "border-[#16ba53] bg-[#16ba53]/10 text-[#16ba53]"
              : "border-slate-200 text-slate-600"
          }`}
        >
          Részletes
        </button>
      </div>

      {/* Összesítő badge-ek */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(totalsByCurrency).length > 0 ? (
          Object.keys(totalsByCurrency).map((cur) => (
            <span
              key={cur}
              className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-[11px] text-emerald-700"
            >
              Összes költés:{" "}
              <span className="font-semibold ml-1">
                {totalsByCurrency[cur].toFixed(2)} {cur}
              </span>
            </span>
          ))
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600">
            Nincs még költség a kiválasztott nézetben.
          </span>
        )}

        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700">
          {groupMode === "category" && "Kategóriák száma:"}
          {groupMode === "currency" && "Pénznemek száma:"}
          {groupMode === "user" && "Résztvevők száma:"}{" "}
          <span className="font-semibold ml-1">{groupCount}</span>
        </span>
      </div>

      {!hasAnyData ? (
        <p className="text-[11px] text-slate-500">
          Még nincs rögzített költség ehhez az utazáshoz a kiválasztott
          időszakban.
        </p>
      ) : (
        <>
          {groupMode === "category" && (
            <div className="space-y-2">
              {categoryRows.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">{cat.category}</span>
                    <span className="font-semibold">
                      {cat.amount.toFixed(2)} {cat.currency}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-[#16ba53] rounded-full"
                      style={{
                        width:
                          maxCategoryAmount > 0
                            ? `${Math.max(
                                8,
                                (cat.amount / maxCategoryAmount) * 100
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="mt-2 text-[10px] text-slate-400">
                A kategóriák a rögzített költségek &quot;Kategória&quot;
                mezője alapján számolódnak. Több pénznem esetén az
                összegzések csak közelítő jellegűek.
              </p>
            </div>
          )}

          {groupMode === "currency" && (
            <div className="space-y-2">
              {currencyRows.map((row) => (
                <div key={row.currency} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium">{row.currency}</span>
                    <span className="font-semibold">
                      {row.amount.toFixed(2)} {row.currency}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-[#16ba53] rounded-full"
                      style={{
                        width:
                          maxCurrencyAmount > 0
                            ? `${Math.max(
                                8,
                                (row.amount / maxCurrencyAmount) * 100
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="mt-2 text-[10px] text-slate-400">
                Itt pénznemenként összesítjük a költéseket. A részletesebb
                bontásért válaszd a &quot;Kategóriák&quot; vagy &quot;Részletes&quot;
                nézetet.
              </p>
            </div>
          )}

          {groupMode === "user" && (
            <div className="space-y-3">
              {detailedUserRows.map((row) => {
                const totalAll = Object.values(row.totalsByCurrency).reduce(
                  (sum, v) => sum + v,
                  0
                );

                const totalSummary = Object.entries(
                  row.totalsByCurrency
                )
                  .map(
                    ([cur, amt]) =>
                      `${amt.toFixed(2)} ${cur}`
                  )
                  .join(" + ");

                return (
                  <div
                    key={row.userId ?? "unknown"}
                    className="border border-slate-100 rounded-2xl px-3 py-2 bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium">{row.label}</span>
                      <span className="font-semibold">{totalSummary}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-2 bg-[#16ba53] rounded-full"
                        style={{
                          width:
                            maxUserTotal > 0
                              ? `${Math.max(
                                  8,
                                  (totalAll / maxUserTotal) * 100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>

                    {/* kategória × pénznem bontás */}
                    <div className="space-y-1">
                      {Object.entries(row.categoriesByCurrency).map(
                        ([currency, cats]) => (
                          <div key={currency}>
                            <p className="text-[10px] font-medium text-slate-500 mb-0.5">
                              {currency}
                            </p>
                            {Object.entries(cats).map(
                              ([catName, amt]) => (
                                <div
                                  key={`${currency}-${catName}`}
                                  className="flex items-center justify-between text-[10px]"
                                >
                                  <span>{catName}</span>
                                  <span className="font-semibold">
                                    {amt.toFixed(2)} {currency}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              <p className="mt-2 text-[10px] text-slate-400">
                Itt azt látod, ki mennyit költött kategóriánként és
                pénznemenként. Jelenleg a saját neved a Google-fiókod neve
                vagy e-mail címe, a többi utazó pedig &quot;Másik utazó&quot;
                néven jelenik meg. Később ide kerül majd a részletes
                elszámolás is (ki tartozik kinek).
              </p>
            </div>
          )}
        </>
      )}

      {periodMode === "day" && selectedDate && (
        <p className="mt-4 text-[10px] text-slate-400">
          Jelenleg a következő nap költéseit látod:{" "}
          <span className="font-semibold">
            {formatDateDisplay(selectedDate)}
          </span>
          .
        </p>
      )}

      {periodMode === "all" && (
        <p className="mt-4 text-[10px] text-slate-400">
          Az &quot;Utazáshoz rögzítve&quot; nézet minden ehhez az utazáshoz
          felvitt költést tartalmaz, függetlenül attól, hogy ténylegesen
          mikor fizetted ki őket (pl. előre kifizetett szállás).
        </p>
      )}
    </section>
  );
}
