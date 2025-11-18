"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { TripExpense } from "../../../lib/trip/types";

type ExpensesSectionProps = {
  tripId: string;
  userId: string | null;
};

const BASE_CATEGORIES = [
  "Szállás",
  "Éttermek",
  "Bolt",
  "Közlekedés",
  "Program",
  "Belépők",
  "Parkolás",
  "Egyéb",
];

const PAYMENT_METHOD_OPTIONS = [
  "Kártya",
  "Készpénz",
  "Online fizetés",
  "Utalvány",
  "Egyéb",
];

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

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ExpensesSection({ tripId, userId }: ExpensesSectionProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [date, setDate] = useState<string>(todayIso());
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHOD_OPTIONS[0]);

  const [hasTouchedCurrency, setHasTouchedCurrency] = useState(false);
  const [hasTouchedPaymentMethod, setHasTouchedPaymentMethod] = useState(false);
  const [categoryFocused, setCategoryFocused] = useState(false);

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoadingExpenses(true);
      setExpenseError(null);

      try {
        const { data, error } = await supabase
          .from("trip_expenses")
          .select("*")
          .eq("trip_id", tripId)
          .order("date", { ascending: true });

        if (error) {
          console.error("Error loading expenses", error);
          setExpenseError("Hiba történt a költségek betöltésekor.");
        } else if (data) {
          const mapped = (data as any[]).map((e) => ({
            ...e,
            amount: Number(e.amount),
          })) as TripExpense[];
          setExpenses(mapped);

          // currency default: utoljára használt
          if (!hasTouchedCurrency && mapped.length > 0) {
            const last = mapped[mapped.length - 1];
            if (last.currency) {
              setCurrency(String(last.currency).toUpperCase());
            }
          }

          // fizetési mód default: utolsó nem-null érték
          if (!hasTouchedPaymentMethod && mapped.length > 0) {
            const lastWithPayment = [...mapped]
              .reverse()
              .find((e) => e.payment_method && e.payment_method.trim() !== "");
            if (lastWithPayment?.payment_method) {
              setPaymentMethod(lastWithPayment.payment_method);
            }
          }
        }
      } catch (e) {
        console.error(e);
        setExpenseError("Váratlan hiba történt a költségek betöltésekor.");
      } finally {
        setLoadingExpenses(false);
      }
    };

    fetchExpenses();
  }, [tripId, hasTouchedCurrency, hasTouchedPaymentMethod]);

  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of BASE_CATEGORIES) {
      set.add(c);
    }
    for (const exp of expenses) {
      if (exp.category && exp.category.trim() !== "") {
        set.add(exp.category.trim());
      }
    }
    return Array.from(set);
  }, [expenses]);

  const categorySuggestions = useMemo(() => {
    if (!categoryFocused || category.trim() === "") return [] as string[];

    const query = category.trim().toLowerCase();
    return knownCategories
      .filter(
        (c) =>
          c.toLowerCase().startsWith(query) &&
          c.toLowerCase() !== query
      )
      .slice(0, 6);
  }, [category, categoryFocused, knownCategories]);

  const totalsByCurrency = useMemo(
    () =>
      expenses.reduce<Record<string, number>>((acc, exp) => {
        const cur = exp.currency || "EUR";
        acc[cur] = (acc[cur] || 0) + (exp.amount || 0);
        return acc;
      }, {}),
    [expenses]
  );

  const isTodaySelected = date === todayIso();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSuccess(null);

    if (!userId) {
      setExpenseError("A költség rögzítéséhez be kell jelentkezned.");
      return;
    }

    if (!date || !amount) {
      setExpenseError("A dátum és az összeg kötelező mező.");
      return;
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount)) {
      setExpenseError("Az összegnek számnak kell lennie.");
      return;
    }

    setSubmittingExpense(true);

    try {
      const { data, error } = await supabase
        .from("trip_expenses")
        .insert([
          {
            trip_id: tripId,
            user_id: userId,
            date,
            category: category.trim() || null,
            note: note.trim() || null,
            amount: parsedAmount,
            currency: (currency || "EUR").toUpperCase(),
            payment_method: paymentMethod?.trim() || null,
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("Error inserting expense", error);
        setExpenseError("Hiba történt a költség rögzítésekor.");
      } else if (data) {
        const mapped: TripExpense = {
          ...(data as any),
          amount: Number((data as any).amount),
        };
        setExpenses((prev) => [...prev, mapped]);
        setExpenseSuccess("Költség sikeresen rögzítve.");
        setCategory("");
        setNote("");
        setAmount("");
        // dátum marad (legtöbbször több költség ugyanazon a napon)
        setTimeout(() => setExpenseSuccess(null), 2500);
      }
    } catch (e) {
      console.error(e);
      setExpenseError("Váratlan hiba történt a költség rögzítésekor.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-1">Költségek</h2>
      <p className="text-xs text-slate-500 mb-3">
        Itt tudod rögzíteni, hogy ki mit fizetett az utazás során. Később ezekből
        számoljuk a statisztikákat.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2 mb-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Dátum
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="flex-1 text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {isTodaySelected && (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Ma
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 relative">
            <label className="block text-[11px] text-slate-600 mb-1">
              Kategória
            </label>
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              placeholder="Pl.: Étterem, Szállás"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onFocus={() => setCategoryFocused(true)}
              onBlur={() => {
                // kis késleltetés, hogy klikkelhessünk a javaslatra
                setTimeout(() => setCategoryFocused(false), 150);
              }}
            />
            {categorySuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-sm max-h-32 overflow-y-auto">
                {categorySuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="w-full text-left text-[11px] px-2 py-1 hover:bg-slate-50"
                    onClick={() => {
                      setCategory(suggestion);
                      setCategoryFocused(false);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-600 mb-1">
            Megjegyzés
          </label>
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
            placeholder="Pl.: vacsora első este..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Összeg *
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="w-24">
            <label className="block text-[11px] text-slate-600 mb-1">
              Pénznem
            </label>
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={currency}
              onChange={(e) => {
                setHasTouchedCurrency(true);
                setCurrency(e.target.value.toUpperCase());
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Fizetési mód
            </label>
            <select
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] bg-white"
              value={paymentMethod}
              onChange={(e) => {
                setHasTouchedPaymentMethod(true);
                setPaymentMethod(e.target.value);
              }}
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="submit"
            disabled={submittingExpense}
            className="px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-60 w-full md:w-auto"
          >
            {submittingExpense ? "Mentés..." : "Költség rögzítése"}
          </button>

          <span className="hidden md:inline text-[10px] text-slate-400">
            A statisztika ehhez a listához igazodik.
          </span>
        </div>
      </form>

      {expenseError && (
        <div className="mt-1 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
          {expenseError}
        </div>
      )}

      {expenseSuccess && (
        <div className="mt-1 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
          {expenseSuccess}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-2">
        {loadingExpenses ? (
          <p className="text-[11px] text-slate-500">Költségek betöltése...</p>
        ) : expenses.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Még nincs rögzített költség ehhez az utazáshoz.
          </p>
        ) : (
          <>
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {expenses.map((exp) => (
                <li
                  key={exp.id}
                  className="text-[11px] flex items-start justify-between gap-2 border border-slate-100 rounded-xl px-2 py-1 bg-white"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {formatDateDisplay(exp.date)}
                      {exp.category ? ` – ${exp.category}` : ""}
                    </p>
                    {exp.note && (
                      <p className="text-[10px] text-slate-600">{exp.note}</p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      Fizetési mód: {exp.payment_method || "n.a."}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Rögzítette:{" "}
                      {userId && exp.user_id === userId
                        ? "Te"
                        : "Másik utazó"}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-semibold">
                      {exp.amount.toFixed(2)} {exp.currency || "EUR"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2 text-[11px] text-slate-700">
              {Object.keys(totalsByCurrency).map((cur) => (
                <p key={cur}>
                  Összesen:{" "}
                  <span className="font-semibold">
                    {totalsByCurrency[cur].toFixed(2)} {cur}
                  </span>
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
