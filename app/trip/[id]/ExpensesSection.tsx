"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { TripExpense } from "../../../lib/trip/types";

type ExpensesSectionProps = {
  tripId: string;
  userId: string | null;
};

export default function ExpensesSection({
  tripId,
  userId,
}: ExpensesSectionProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [date, setDate] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [paymentMethod, setPaymentMethod] = useState<string>("");

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
          setExpenses(
            data.map((e) => ({
              ...e,
              amount: Number(e.amount),
            })) as TripExpense[]
          );
        }
      } catch (e) {
        console.error(e);
        setExpenseError("Váratlan hiba történt a költségek betöltésekor.");
      } finally {
        setLoadingExpenses(false);
      }
    };

    fetchExpenses();
  }, [tripId]);

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
            category: category || null,
            note: note || null,
            amount: parsedAmount,
            currency: currency || "EUR",
            payment_method: paymentMethod || null,
          },
        ])
        .select("*")
        .single();

      if (error) {
        console.error("Error inserting expense", error);
        setExpenseError("Hiba történt a költség rögzítésekor.");
      } else if (data) {
        setExpenses((prev) => [
          ...prev,
          {
            ...data,
            amount: Number(data.amount),
          } as TripExpense,
        ]);
        setExpenseSuccess("Költség sikeresen rögzítve.");
        setDate("");
        setCategory("");
        setNote("");
        setAmount("");
        setPaymentMethod("");
      }
    } catch (e) {
      console.error(e);
      setExpenseError("Váratlan hiba történt a költség rögzítésekor.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const totalsByCurrency = expenses.reduce<Record<string, number>>(
    (acc, exp) => {
      const cur = exp.currency || "EUR";
      acc[cur] = (acc[cur] || 0) + (exp.amount || 0);
      return acc;
    },
    {}
  );

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-2">Költségek</h2>
      <p className="text-xs text-slate-500 mb-3">
        Itt tudod rögzíteni az utazás költségeit. Később ezekből számoljuk a
        statisztikákat.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2 mb-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Dátum
            </label>
            <input
              type="date"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Kategória
            </label>
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              placeholder="Szállás, étel, benzin..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-600 mb-1">
            Megjegyzés
          </label>
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
            placeholder="Rövid leírás a költségről..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Összeg
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="w-20">
            <label className="block text-[11px] text-slate-600 mb-1">
              Pénznem
            </label>
            <input
              type="text"
              className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-600 mb-1">
            Fizetési mód
          </label>
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
            placeholder="Készpénz, kártya..."
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="submit"
            disabled={submittingExpense}
            className="px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {submittingExpense ? "Mentés..." : "Költség hozzáadása"}
          </button>

          <span className="text-[10px] text-slate-400">
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
          <p className="text-[11px] text-slate-500">
            Költségek betöltése...
          </p>
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
                  className="text-[11px] flex items-start justify-between gap-2 border border-slate-100 rounded-xl px-2 py-1"
                >
                  <div>
                    <p className="font-medium">
                      {exp.category || "Egyéb"} – {exp.amount.toFixed(2)}{" "}
                      {exp.currency || "EUR"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {exp.date}{" "}
                      {exp.payment_method
                        ? `• ${exp.payment_method}`
                        : null}
                    </p>
                    {exp.note && (
                      <p className="text-[10px] text-slate-600">
                        {exp.note}
                      </p>
                    )}
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
