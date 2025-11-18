"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase } from "../../../lib/supabaseClient";

type NotesSectionProps = {
  tripId: string;
  initialNotes: string | null;
};

export default function NotesSection({ tripId, initialNotes }: NotesSectionProps) {
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setNotes(initialNotes ?? "");
  }, [initialNotes]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("trips")
        .update({ notes: notes.trim() === "" ? null : notes })
        .eq("id", tripId);

      if (error) {
        console.error("NOTES UPDATE ERROR:", error);
        setError("Nem sikerült elmenteni a jegyzetet. Próbáld újra később.");
      } else {
        setSuccess("Jegyzet elmentve.");
        const now = new Date();
        setLastSavedAt(now);
        // kis idő után tűnjön el a siker üzenet
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }
    } catch (err: any) {
      console.error("NOTES UPDATE ERROR:", err);
      setError("Váratlan hiba történt a jegyzet mentése közben.");
    } finally {
      setSaving(false);
    }
  };

  const renderLastSaved = () => {
    if (!lastSavedAt) return null;
    const formatted = new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(lastSavedAt);

    return (
      <p className="text-[10px] text-slate-400 mt-1 md:text-right">
        Utoljára mentve: {formatted}
      </p>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-1">Jegyzet</h2>
      <p className="text-xs text-slate-500 mb-3">
        Ide írhatod az utazás terveit, emlékeket, fontos információkat.
      </p>

      <form onSubmit={handleSave}>
        <textarea
          className="w-full text-sm border border-slate-300 rounded-2xl px-3 py-3 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53] shadow-sm min-h-[140px] resize-vertical"
          placeholder="Pl.: Érkezés 14:00-kor, találkozó a reptéren, első nap városnézés…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-4 py-2 rounded-2xl bg-[#16ba53] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? "Mentés..." : "Jegyzet mentése"}
          </button>

          <div className="flex-1">
            <p className="text-[11px] text-slate-400 md:text-right">
              A jegyzet nem mentődik automatikusan – használd a &quot;Jegyzet
              mentése&quot; gombot.
            </p>
            {renderLastSaved()}
          </div>
        </div>

        {error && (
          <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-2 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
            {success}
          </div>
        )}
      </form>
    </div>
  );
}
