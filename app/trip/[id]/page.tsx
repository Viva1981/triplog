"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type User = {
  id: string;
  email?: string;
};

type Trip = {
  id: string;
  owner_id: string;
  title: string;
  destination: string | null;
  date_from: string | null;
  date_to: string | null;
};

type Expense = {
  id: string;
  date: string;
  category: string | null;
  note: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return dateStr ?? "";
  }
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Költségek állapot
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  // Új költség űrlap állapot
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("EUR");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);

  // User betöltése
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoadingUser(false);
        router.push("/"); // nincs login → vissza a főoldalra
        return;
      }

      setUser({ id: user.id, email: user.email ?? undefined });
      setLoadingUser(false);
    };

    fetchUser();
  }, [router]);

  // Trip betöltése
  useEffect(() => {
    const fetchTrip = async () => {
      const tripId = params?.id;
      if (!tripId || Array.isArray(tripId)) {
        setError("Érvénytelen utazás azonosító.");
        setLoadingTrip(false);
        return;
      }

      setLoadingTrip(true);
      setError(null);

      const { data, error } = await supabase
        .from("trips")
        .select("id, owner_id, title, destination, date_from, date_to")
        .eq("id", tripId)
        .single();

      if (error || !data) {
        console.error("TRIP FETCH ERROR:", error);
        setError(
          error?.message ??
            "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."
        );
        setTrip(null);
      } else {
        setTrip(data as Trip);
      }

      setLoadingTrip(false);
    };

    if (!loadingUser) {
      fetchTrip();
    }
  }, [params, loadingUser]);

  // Költségek betöltése
  useEffect(() => {
    const fetchExpenses = async () => {
      const tripId = params?.id;
      if (!tripId || Array.isArray(tripId) || !user) {
        setExpenses([]);
        return;
      }

      setLoadingExpenses(true);
      setExpensesError(null);

      const { data, error } = await supabase
        .from("trip_expenses")
        .select("id, date, category, note, amount, currency, payment_method")
        .eq("trip_id", tripId)
        .order("date", { ascending: true });

      if (error) {
        console.error("EXPENSES FETCH ERROR:", error);
        setExpensesError(
          error.message ?? "Nem sikerült betölteni a költségeket."
        );
      } else {
        setExpenses((data ?? []) as Expense[]);
      }

      setLoadingExpenses(false);
    };

    if (user && trip) {
      fetchExpenses();
    }
  }, [params, user, trip]);

  const handleExpenseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !trip) return;

    setSubmittingExpense(true);
    setExpensesError(null);
    setExpenseSuccess(null);

    if (!expenseAmount) {
      setExpensesError("Az összeg megadása kötelező.");
      setSubmittingExpense(false);
      return;
    }

    try {
      const tripId = trip.id;
      const parsedAmount = parseFloat(expenseAmount.replace(",", "."));
      if (isNaN(parsedAmount)) {
        setExpensesError("Érvénytelen összeg.");
        setSubmittingExpense(false);
        return;
      }

      const { data, error } = await supabase
        .from("trip_expenses")
        .insert({
          trip_id: tripId,
          user_id: user.id,
          date: expenseDate || new Date().toISOString().slice(0, 10),
          category: expenseCategory.trim() || null,
          note: expenseNote.trim() || null,
          amount: parsedAmount,
          currency: expenseCurrency || "EUR",
          payment_method: expensePaymentMethod.trim() || null,
        })
        .select("id, date, category, note, amount, currency, payment_method")
        .single();

      if (error || !data) {
        console.error("EXPENSE INSERT ERROR:", error);
        setExpensesError(
          error?.message ?? "Nem sikerült elmenteni a költséget."
        );
      } else {
        // új költség hozzáadása a listához
        setExpenses((prev) => [...prev, data as Expense]);
        setExpenseSuccess("Költség sikeresen rögzítve.");
        // űrlap ürítése
        setExpenseDate("");
        setExpenseCategory("");
        setExpenseNote("");
        setExpenseAmount("");
        setExpensePaymentMethod("");
      }
    } catch (err: any) {
      console.error("EXPENSE SUBMIT ERROR:", err);
      setExpensesError(err?.message ?? "Ismeretlen hiba történt.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  if (loadingUser || loadingTrip) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">
            Hiba az utazás betöltése közben
          </h1>
          <p className="text-sm text-red-600 mb-4">
            {error ??
              "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."}
          </p>
          <Link href="/" className="text-sm text-[#16ba53] underline">
            Vissza a főoldalra
          </Link>
        </div>
      </main>
    );
  }

  const from = formatDate(trip.date_from);
  const to = formatDate(trip.date_to);

  const isOwner = user && user.id === trip.owner_id;

  // Költségek összegzése egyszerűen (összesített összeg)
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Vissza link */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <span className="mr-1">←</span> Vissza a főoldalra
          </Link>
        </div>

        {/* Fő info kártya */}
        <section className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold mb-1">{trip.title}</h1>
              <p className="text-sm text-slate-600 mb-1">
                {trip.destination || "Nincs megadott desztináció"}
              </p>
              {(from || to) && (
                <p className="text-xs text-slate-500">
                  {from && to
                    ? `${from} – ${to}`
                    : from
                    ? `Kezdés: ${from}`
                    : `Befejezés: ${to}`}
                </p>
              )}
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              {isOwner && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#16ba53]/10 text-[#16ba53] text-xs font-semibold">
                  Te vagy az utazás tulajdonosa
                </span>
              )}
              {user?.email && (
                <div className="text-right text-[11px] text-slate-500">
                  <p className="font-semibold">Bejelentkezve:</p>
                  <p>{user.email}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Szekciók – fotók, dokumentumok, jegyzetek stb. */}
        <section className="grid gap-4 md:grid-cols-2 mb-4">
          {/* Fotók */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Fotók</h2>
            <p className="text-xs text-slate-500">
              Ide kerülnek majd az utazáshoz tartozó fotók a Google Drive-ból.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📷
            </div>
          </div>

          {/* Dokumentumok */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Dokumentumok</h2>
            <p className="text-xs text-slate-500">
              Itt fognak megjelenni a beszállókártyák, foglalások, szerződések
              és egyéb fájlok.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📄
            </div>
          </div>

          {/* Jegyzet */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Jegyzet</h2>
            <p className="text-xs text-slate-500">
              Utazási terv, emlékek, teendők, tennivalók – minden egy helyen.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📝
            </div>
          </div>

          {/* Költségek – űrlap + lista */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Költségek</h2>
            <p className="text-xs text-slate-500 mb-3">
              Itt tudod rögzíteni, hogy ki mit fizetett az utazás során.
            </p>

            {/* Költség űrlap */}
            <form onSubmit={handleExpenseSubmit} className="space-y-2 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Dátum
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Kategória
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                    placeholder="Pl.: Étterem, Szállás"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1">
                  Megjegyzés
                </label>
                <input
                  type="text"
                  className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                  placeholder="Pl.: vacsora első este"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Összeg *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Pénznem
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">
                    Fizetési mód
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-xl px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                    placeholder="Pl.: készpénz, kártya"
                    value={expensePaymentMethod}
                    onChange={(e) =>
                      setExpensePaymentMethod(e.target.value)
                    }
                  />
                </div>
              </div>

              {expensesError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
                  {expensesError}
                </div>
              )}

              {expenseSuccess && (
                <div className="text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
                  {expenseSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full py-1.5 px-3 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition text-xs"
              >
                {submittingExpense ? "Mentés..." : "Költség rögzítése"}
              </button>
            </form>

            {/* Költségek lista */}
            <div className="border-t border-slate-100 pt-2">
              {loadingExpenses && (
                <p className="text-[11px] text-slate-500">
                  Költségek betöltése...
                </p>
              )}

              {!loadingExpenses && expenses.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  Még nincs rögzített költség ennél az utazásnál.
                </p>
              )}

              {!loadingExpenses && expenses.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between text-[11px] py-1 border-b border-slate-50"
                    >
                      <div>
                        <div className="font-medium">
                          {formatDate(exp.date)} –{" "}
                          {exp.category || "Egyéb költség"}
                        </div>
                        {exp.note && (
                          <div className="text-slate-500">{exp.note}</div>
                        )}
                        {exp.payment_method && (
                          <div className="text-[10px] text-slate-400">
                            Fizetési mód: {exp.payment_method}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-semibold">
                        {exp.amount.toFixed(2)} {exp.currency}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingExpenses && expenses.length > 0 && (
                <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                  Összesen: {totalAmount.toFixed(2)} {expenseCurrency}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Költségek statisztika – teljes szélesség */}
        <section className="mt-4">
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">
              Költségek statisztika
            </h2>
            <p className="text-xs text-slate-500">
              Itt fogsz kördiagramot látni arról, mire mennyit költöttetek az
              utazás során.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Funkció hamarosan érkezik. 📊
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
