"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { TripExpense } from "../../../lib/trip/types";

// Ugyanaz a becslés, mint a részletes nézetben
const ESTIMATED_RATES: Record<string, number> = {
  HUF: 1,
  EUR: 380,
  USD: 340,
  GBP: 450,
  CHF: 400,
  PLN: 91,
  CZK: 16,
  RON: 80,
  RSD: 3.4,
};

function getNormalizedValue(amount: number, currency: string): number {
  const rate = ESTIMATED_RATES[currency.toUpperCase()] || 1;
  return amount * rate;
}

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
    // Egyszerűsítés: Ha több pénznem van egy kategórián belül, a főoldali
    // statisztika nem biztos, hogy pontos, de a csík hosszát normalizálva számoljuk.
    // Itt a logikánk: minden sort külön kezelünk, vagy összevonunk?
    // A StatsSection egyszerűsített nézet, maradjunk az eredeti logikánál, 
    // de adjunk hozzá normalizált értéket a csíkhoz.
    
    // TRÜKK: Itt most külön sorokat generálunk inkább minden deviza-kategória párhoz?
    // Vagy összevonjuk? Az egyszerűség kedvéért a főoldalon maradjunk a
    // "Kategória" alapú bontásnál. Ha vegyes a deviza, akkor is megpróbáljuk összeadni normalizálva.
    
    if (!acc[key]) {
      acc[key] = { amount: 0, currency: cur }; // currency csak tájékoztató jellegű lesz
    }
    // Itt a trükk: a 'amount' mezőben most a NORMALIZÁLT értéket tároljuk átmenetileg? 
    // Nem, mert ki kell írni az eredetit.
    // Inkább tároljunk egy listát.
    return acc;
  }, {});
  
  // -- ÚJ LOGIKA A FŐOLDALI ÖSSZESÍTÉSHEZ --
  
  type CatSummary = {
    category: string;
    items: { currency: string, amount: number }[];
    totalNormalized: number;
  };
  
  const categoryMap = new Map<string, CatSummary>();
  
  for(const exp of expenses) {
      const cat = exp.category || "Egyéb";
      const cur = exp.currency || "EUR";
      const amt = Number(exp.amount || 0);
      
      if(!categoryMap.has(cat)) {
          categoryMap.set(cat, { category: cat, items: [], totalNormalized: 0 });
      }
      
      const entry = categoryMap.get(cat)!;
      // Megnézzük, van-e már ilyen deviza ebben a kategóriában
      const existingItem = entry.items.find(i => i.currency === cur);
      if(existingItem) {
          existingItem.amount += amt;
      } else {
          entry.items.push({ currency: cur, amount: amt });
      }
      
      entry.totalNormalized += getNormalizedValue(amt, cur);
  }
  
  const categories = Array.from(categoryMap.values());
  // Rendezés a normalizált összérték szerint
  categories.sort((a, b) => b.totalNormalized - a.totalNormalized);
  
  const maxNormalized = categories.length > 0 ? categories[0].totalNormalized : 0;

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
              {totalsByCurrency[cur].toLocaleString("hu-HU", {minimumFractionDigits: 2, maximumFractionDigits: 2})} {cur}
            </span>
          </span>
        ))}
      </div>

      <div className="space-y-3 mb-2">
        {categories.map((cat) => (
          <div key={cat.category} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">{cat.category}</span>
              <span className="font-semibold text-slate-600">
                  {/* Kiírjuk az összegeket (pl. 100 EUR • 5000 HUF) */}
                  {cat.items.map(i => `${i.amount.toLocaleString("hu-HU", {maximumFractionDigits:0})} ${i.currency}`).join(" • ")}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-[#16ba53] rounded-full transition-all duration-500"
                style={{
                  width:
                    maxNormalized > 0
                      ? `${Math.max(
                          8,
                          (cat.totalNormalized / maxNormalized) * 100
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        A csíkok hossza becsült árfolyamon átszámolva arányos.
      </p>
    </section>
  );
}