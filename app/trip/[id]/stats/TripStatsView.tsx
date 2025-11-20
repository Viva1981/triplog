"use client";

import { useMemo, useState } from "react";
import { TripExpense, TripMemberInfo, TripInfo } from "@/lib/trip/types";

interface Props {
  trip: TripInfo;
  expenses: TripExpense[];
  members: TripMemberInfo[];
}

export default function TripStatsView({ trip, expenses, members }: Props) {
  const [mode, setMode] = useState<"trip" | "day">("trip");
  const [tab, setTab] = useState<"categories" | "currencies" | "detailed">(
    "categories"
  );

  const selectedDate = null;

  const filteredExpenses = useMemo(() => {
    if (mode === "trip") return expenses;
    if (!selectedDate) return [];
    return expenses.filter((e) => e.date === selectedDate);
  }, [mode, selectedDate, expenses]);

  // Összegző segédfüggvény
  const sumAmount = (items: TripExpense[]) =>
    items.reduce((acc, x) => acc + Number(x.amount || 0), 0);

  // Pénznem → összes bontás
  const currencyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredExpenses) {
      const curr = e.currency.toUpperCase();
      map.set(curr, (map.get(curr) || 0) + Number(e.amount));
    }
    return Array.from(map.entries()).map(([currency, amount]) => ({
      currency,
      amount,
    }));
  }, [filteredExpenses]);

  // Kategória → Pénznem bontás
  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; amount: number }[]
    >();

    for (const e of filteredExpenses) {
      const cat = e.category?.trim() || "Egyéb";
      const curr = e.currency.toUpperCase();
      const amount = Number(e.amount);

      if (!map.has(cat)) map.set(cat, []);
      const arr = map.get(cat)!;

      const existing = arr.find((x) => x.currency === curr);
      if (existing) existing.amount += amount;
      else arr.push({ currency: curr, amount });
    }

    return Array.from(map.entries()).map(([category, list]) => ({
      category,
      list,
    }));
  }, [filteredExpenses]);

  // Pénznemek → Fizetési mód bontás
  const currencyPaymentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { method: string; amount: number }[]
    >();

    for (const e of filteredExpenses) {
      const curr = e.currency.toUpperCase();
      const method = e.payment_method?.trim() || "Egyéb";
      const amount = Number(e.amount);

      if (!map.has(curr)) map.set(curr, []);
      const arr = map.get(curr)!;

      const existing = arr.find((x) => x.method === method);
      if (existing) existing.amount += amount;
      else arr.push({ method, amount });
    }

    return Array.from(map.entries()).map(([currency, list]) => ({
      currency,
      list,
      total: list.reduce((acc, x) => acc + x.amount, 0),
    }));
  }, [filteredExpenses]);

  // Részletes bontás: résztvevő → pénznem → kategória
  const detailedBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; category: string; amount: number }[]
    >();

    for (const e of filteredExpenses) {
      const member = members.find((m) => m.user_id === e.user_id);
      const name =
        member?.display_name ||
        member?.email?.split("@")[0] ||
        "Ismeretlen";

      const cat = e.category?.trim() || "Egyéb";
      const curr = e.currency.toUpperCase();
      const amount = Number(e.amount);

      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({ currency: curr, category: cat, amount });
    }

    return Array.from(map.entries()).map(([name, list]) => ({
      name,
      list,
      total: list.reduce((acc, x) => acc + x.amount, 0),
    }));
  }, [filteredExpenses, members]);

  return (
    <div className="space-y-6">
      {/* --- Mode selector --- */}
      <div className="flex gap-3">
        <button
          onClick={() => setMode("trip")}
          className={`px-4 py-2 rounded-full text-sm ${
            mode === "trip"
              ? "bg-green-600 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          Utazáshoz rögzítve
        </button>

        <button
          onClick={() => setMode("day")}
          className={`px-4 py-2 rounded-full text-sm ${
            mode === "day"
              ? "bg-green-600 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          Megadott nap
        </button>
      </div>

      {/* --- Tabok --- */}
      <div className="flex gap-3">
        <button
          onClick={() => setTab("categories")}
          className={`px-4 py-2 rounded-full text-sm ${
            tab === "categories"
              ? "bg-green-600 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          Kategóriák
        </button>

        <button
          onClick={() => setTab("currencies")}
          className={`px-4 py-2 rounded-full text-sm ${
            tab === "currencies"
              ? "bg-green-600 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          Pénznemek
        </button>

        <button
          onClick={() => setTab("detailed")}
          className={`px-4 py-2 rounded-full text-sm ${
            tab === "detailed"
              ? "bg-green-600 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          Részletes
        </button>
      </div>

      {/* --- Összesítések TripHeader stílusban --- */}
      <div className="flex gap-4 flex-wrap">
        {currencyTotals.map((x) => (
          <div
            key={x.currency}
            className="bg-slate-100 px-3 py-1 rounded-full text-sm"
          >
            {x.currency} összesen:{" "}
            <span className="font-bold">
              {x.amount.toLocaleString("hu-HU", {
                minimumFractionDigits: 2,
              })}{" "}
              {x.currency}
            </span>
          </div>
        ))}
      </div>

      {/* --- TARTALMI NÉZETEK --- */}

      {/* 1) Kategóriák × Pénznem */}
      {tab === "categories" && (
        <div className="space-y-6">
          {categoryBreakdown.map((row) => (
            <div key={row.category}>
              <h3 className="font-medium text-lg mb-1">{row.category}</h3>

              {row.list.map((item) => (
                <div key={item.currency} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.currency}</span>
                    <span>
                      {item.amount.toLocaleString("hu-HU", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {item.currency}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full">
                    <div
                      className="h-2 bg-green-600 rounded-full"
                      style={{
                        width: `${
                          (item.amount /
                            (currencyTotals.find(
                              (x) => x.currency === item.currency
                            )?.amount || 1)) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 2) Pénznemek × Fizetési mód */}
      {tab === "currencies" && (
        <div className="space-y-6">
          {currencyPaymentBreakdown.map((row) => (
            <div key={row.currency}>
              <h3 className="font-medium text-lg mb-1">
                {row.currency} —{" "}
                {row.total.toLocaleString("hu-HU", {
                  minimumFractionDigits: 2,
                })}{" "}
                {row.currency}
              </h3>

              {row.list.map((item) => (
                <div key={item.method} className="mb-3">
                  <div className="flex justify-between text-sm">
                    <span>{item.method}</span>
                    <span>
                      {item.amount.toLocaleString("hu-HU", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {row.currency}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full">
                    <div
                      className="h-2 bg-green-600 rounded-full"
                      style={{
                        width: `${(item.amount / row.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 3) Részletes nézet */}
      {tab === "detailed" && (
        <div className="space-y-8">
          {detailedBreakdown.map((row) => (
            <div key={row.name}>
              <h3 className="font-semibold text-lg mb-1">{row.name}</h3>

{Object.values(
  row.list.reduce((acc, x) => {
    const key = `${x.currency}-${x.category}`;
    if (!acc[key]) {
      acc[key] = {
        curr: x.currency,
        cat: x.category,
        amt: 0,
      };
    }
    acc[key].amt += x.amount;
    return acc;
  }, {} as Record<string, { curr: string; cat: string; amt: number }>)
).map((x) => (
  <div key={x.cat + x.curr} className="mb-2">
    <div className="flex justify-between text-sm">
      <span>
        {x.cat} ({x.curr})
      </span>
      <span>
        {x.amt.toLocaleString("hu-HU", {
          minimumFractionDigits: 2,
        })}{" "}
        {x.curr}
      </span>
    </div>
  </div>
))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
