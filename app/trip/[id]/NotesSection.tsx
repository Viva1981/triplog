"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type NotesSectionProps = {
  tripId: string;
  initialNotes: string | null;
};

export default function NotesSection({ tripId, initialNotes }: NotesSectionProps) {
  const [note, setNote] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from("trips")
        .update({ notes: note })
        .eq("id", tripId);

      if (error) {
        console.error("Error updating notes", error);
        setError("Hiba történt a jegyzet mentése közben. Próbáld újra később.");
      } else {
        setSuccess("Jegyzet elmentve.");
      }
    } catch (e) {
      console.error(e);
      setError("Váratlan hiba történt a mentés során.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-2">Jegyzet</h2>
      <p className="text-xs text-slate-500 mb-2">
        Ide írhatsz bármit az utazásról: teendők, ötletek, emlékek, fontos infók.
      </p>

      <textarea
        className="w-full min-h-[140px] text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#16ba53]/30 focus:border-[#16ba53]"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        placeholder="Írd ide a jegyzetet az utazáshoz..."
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-60"
        >
          {saving ? "Mentés..." : "Jegyzet mentése"}
        </button>

        <span className="text-[10px] text-slate-400">
          Jegyzet automatikusan nem mentődik – használd a gombot.
        </span>
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
    </div>
  );
}
