"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { TripExpense, TripMember } from "../../../lib/trip/types";

type ExpensesSectionProps = {
  tripId: string;
  userId: string | null; // kívülről így jön, belül currentUserId-ként használjuk
};

type PaymentMethodOption =
  | "Készpénz"
  | "Kártya"
  | "Online fizetés"
  | "Utalvány"
  | "Egyéb";

const PAYMENT_METHODS: PaymentMethodOption[] = [
  "Készpénz",
  "Kártya",
  "Online fizetés",
  "Utalvány",
  "Egyéb",
];

function todayIso(): string {
  const d = new Date();
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

export default function ExpensesSection({
  tripId,
  userId: currentUserId,
}: ExpensesSectionProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // űrlap state
  const [date, setDate] = useState<string>(todayIso());
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodOption>("Készpénz");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // költségek
        const { data: expData, error: expError } = await supabase
          .from("trip_expenses")
          .select(
            "id, trip_id, user_id, date, category, note, amount, currency, payment_method, created_at"
          )
          .eq("trip_id", tripId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (expError) {
          console.error("EXPENSES FETCH ERROR:", expError);
          throw new Error("Nem sikerült betölteni a költségeket.");
        }

        const mapped = (expData || []).map((e: any) => ({
          ...e,
          amount: Number(e.amount),
        })) as TripExpense[];

        setExpenses(mapped);

        // last-used currency + payment method
        if (mapped.length > 0) {
          const last = mapped[0];
          if (last.currency) setCurrency(last.currency.toUpperCase());
          if (
            last.payment_method &&
            PAYMENT_METHODS.includes(
              last.payment_method as PaymentMethodOption
            )
          ) {
            setPaymentMethod(last.payment_method as PaymentMethodOption);
          }
        }

        // útitársak (accepted tagok)
        const { data: memberData, error: memberError } = await supabase
          .from("trip_members")
          .select(
            "id, trip_id, user_id, role, status, display_name, email"
          )
          .eq("trip_id", tripId)
          .eq("status", "accepted");

        if (memberError) {
          console.error("TRIP_MEMBERS FETCH ERROR:", memberError);
          // nem dobjuk tovább, csak logoljuk – a költséglista attól még működjön
        } else if (memberData) {
          setMembers(memberData as TripMember[]);
        }
      } catch (e: any) {
        console.error(e);
        setError(
          e?.message ??
            "Ismeretlen hiba történt a költségek betöltésekor."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tripId]);

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const exp of expenses) {
      if (exp.category && exp.category.trim() !== "") {
        set.add(exp.category.trim());
      }
    }
    return Array.from(set).sort();
  }, [expenses]);

  const totalsByCurrency = useMemo(
    () =>
      expenses.reduce<Record<string, number>>((acc, exp) => {
        const cur = (exp.currency || "EUR").toUpperCase();
        const amt = Number(exp.amount) || 0;
        acc[cur] = (acc[cur] || 0) + amt;
        return acc;
      }, {}),
    [expenses]
  );

  const isToday = date === todayIso();

  const getRecorderLabel = (exp: TripExpense): string => {
    if (!exp.user_id) return "Rögzítette: Útitárs";
    if (currentUserId && exp.user_id === currentUserId) {
      return "Rögzítette: Te";
    }

    const member = members.find((m) => m.user_id === exp.user_id);
    const name = member?.display_name || member?.email || null;

    if (name) {
      return `Rögzítette: Útitárs – ${name}`;
    }
    return "Rögzítette: Útitárs";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setFormError(
        "Költséget csak bejelentkezett felhasználó tud rögzíteni."
      );
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      setFormError("Adj meg egy érvényes összeget.");
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      const numericAmount = Number(amount);
      const trimmedCategory = category.trim() || null;
      const trimmedNote = note.trim() || null;
      const cur = currency.trim().toUpperCase() || "EUR";

      const { data, error } = await supabase
        .from("trip_expenses")
        .insert({
          trip_id: tripId,
          user_id: currentUserId,
          date,
          category: trimmedCategory,
          note: trimmedNote,
          amount: numericAmount,
          currency: cur,
          payment_method: paymentMethod,
        })
        .select(
          "id, trip_id, user_id, date, category, note, amount, currency, payment_method, created_at"
        )
        .single();

      if (error || !data) {
        console.error("EXPENSE INSERT ERROR:", error);
        throw new Error(
          error?.message ?? "Nem sikerült rögzíteni a költséget."
        );
      }

      const mapped: TripExpense = {
        ...data,
        amount: Number(data.amount),
      };

      setExpenses((prev) => [mapped, ...prev]);
      setFormSuccess("Költség rögzítve.");
      setAmount("");
      setNote("");

      // currency / payment method marad, hogy gyors legyen a következő rögzítés
    } catch (err: any) {
      console.error(err);
      setFormError(
        err?.message ?? "Ismeretlen hiba történt rögzítés közben."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-md p-4 md:p-5 border border-slate-100">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Költségek</h2>
      <p className="text-xs text-slate-500 mb-4">
        Itt tudod rögzíteni, hogy ki mit fizetett az utazás során. Később
        ezekből számoljuk a statisztikákat.
      </p>

      {/* űrlap */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 bg-slate-50/60 rounded-2xl p-3 mb-4 text-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Dátum
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {isToday && (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-[10px] text-emerald-700">
                  Ma
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Kategória
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs"
                placeholder="Pl.: Étterem, Szállás"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="category-suggestions"
              />
              {categorySuggestions.length > 0 && (
                <datalist id="category-suggestions">
                  {categorySuggestions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Megjegyzés
          </label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs"
            placeholder="Pl.: vacsora első este..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Összeg *
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs"
              placeholder="Pl.: 50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Pénznem
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs uppercase"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Fizetési mód
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] text-xs"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethodOption)
              }
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {formError}
          </p>
        )}
        {formSuccess && (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            {formSuccess}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? "Rögzítés..." : "Költség rögzítése"}
          </button>
          <p className="text-[10px] text-slate-400">
            A statisztika ehhez a listához igazodik.
          </p>
        </div>
      </form>

      {/* lista */}
      {loading ? (
        <p className="text-[11px] text-slate-500">Költségek betöltése...</p>
      ) : expenses.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Még nincs rögzített költség ehhez az utazáshoz.
        </p>
      ) : (
        <div className="bg-slate-50/60 rounded-2xl p-3 text-[11px] max-h-72 overflow-y-auto">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="border border-slate-100 rounded-2xl px-3 py-2 mb-2 last:mb-0 bg-white"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium">
                  {formatDateDisplay(exp.date)}{" "}
                  {exp.category ? `– ${exp.category}` : ""}
                </span>
                <span className="font-semibold">
                  {exp.amount.toFixed(2)}{" "}
                  {(exp.currency || "EUR").toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 space-y-0.5">
                {exp.note && <p>{exp.note}</p>}
                <p>Fizetési mód: {exp.payment_method || "n.a."}</p>
                <p>{getRecorderLabel(exp)}</p>
              </div>
            </div>
          ))}

          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-600 space-y-0.5">
            {Object.entries(totalsByCurrency).map(([cur, amt]) => (
              <p key={cur}>
                Összesen:{" "}
                <span className="font-semibold">
                  {amt.toFixed(2)} {cur}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
