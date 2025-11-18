"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { TripExpense } from "../../../lib/trip/types";

type StatsSectionProps = {
  tripId: string;
};

export default function StatsSection({ tripId }: StatsSectionProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("trip_expenses")
          .select("id, trip_id, date, category, amount, currency")
          .eq("trip_id", tripId);

        if (error) {
          console.error("Error loading expenses for stats", error);
          setError("Hiba történt a statisztikák betöltésekor.");
        } else if (data) {
          setExpenses(
            data.map((e) => ({
              ...e,
              amount: Number(e.amount),
            })) as TripExpense[]
          );
        }
      } catch (e) {
        console.error(e);
        setError("Váratlan hiba történt a statisztikák betöltésekor.");
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [tripId]);

  if (loading) {
    return (
      <section
        id="trip-stats"
        className="mt-4 bg-white rounded-2xl shadow-md p-4 border border-slate-100"
      >
        <h2 className="text-sm font-semibold mb-2">Költség statisztika</h2>
        <p className="text-[11px] text-slate-500">
          Statisztikák betöltése...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="trip-stats"
        className="mt-4 bg-white rounded-2xl shadow-md p-4 border border-slate-100"
      >
        <h2 className="text-sm font-semibold mb-2">Költség statisztika</h2>
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
          {error}
        </div>
      </section>
    );
  }

  if (expenses.length === 0) {
    return (
      <section
        id="trip-stats"
        className="mt-4 bg-white rounded-2xl shadow-md p-4 border border-slate-100"
      >
        <h2 className="text-sm font-semibold mb-2">Költség statisztika</h2>
        <p className="text-[11px] text-slate-500">
          Még nincs elég adat a statisztikához. Adj hozzá néhány költséget, és
          itt fogsz látni egy összefoglalót a kategóriákról.
        </p>
      </section>
    );
  }

  const totalsByCurrency = expenses.reduce<Record<string, number>>(
    (acc, exp) => {
      const cur = exp.currency || "EUR";
      acc[cur] = (acc[cur] || 0) + (exp.amount || 0);
      return acc;
    },
    {}
  );

  const totalsByCategoryMap = expenses.reduce<
    Record<string, { amount: number; currency: string }>
  >((acc, exp) => {
    const key = exp.category || "Egyéb";
    const cur = exp.currency || "EUR";
    if (!acc[key]) {
      acc[key] = { amount: 0, currency: cur };
    }
    acc[key].amount += exp.amount || 0;
    return acc;
  }, {});

  const totalsByCategory = Object.entries(totalsByCategoryMap).map(
    ([name, v]) => ({
      category: name,
      amount: v.amount,
      currency: v.currency,
    })
  );

  const maxAmount =
    totalsByCategory.length > 0
      ? Math.max(...totalsByCategory.map((c) => c.amount))
      : 0;

  return (
    <section
      id="trip-stats"
      className="mt-4 bg-white rounded-2xl shadow-md p-4 border border-slate-100"
    >
      <h2 className="text-sm font-semibold mb-2">Költség statisztika</h2>
      <p className="text-xs text-slate-500 mb-3">
        Egyszerű összefoglaló arról, hogy mire mennyi ment el ezen az utazáson.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {Object.keys(totalsByCurrency).map((cur) => (
          <span
            key={cur}
            className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700"
          >
            Összes költés:{" "}
            <span className="font-semibold ml-1">
              {totalsByCurrency[cur].toFixed(2)} {cur}
            </span>
          </span>
        ))}

        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700">
          Kategóriák száma:{" "}
          <span className="font-semibold ml-1">
            {totalsByCategory.length}
          </span>
        </span>
      </div>

      <div className="space-y-2 mb-2">
        {totalsByCategory.map((cat) => (
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
                    maxAmount > 0
                      ? `${Math.max(
                          8,
                          (cat.amount / maxAmount) * 100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        A kategóriák az űrlap &quot;Kategória&quot; mezőjéből jönnek. Több
        pénznem esetén az összegzések csak közelítő jellegűek.
      </p>
    </section>
  );
}
