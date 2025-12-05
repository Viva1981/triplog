"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { buildTripFolderName } from "@/lib/trip/format";
import { ChevronLeft } from "lucide-react";

export default function NewTripPage() {
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------
  // GOOGLE DRIVE HELPER FÜGGVÉNYEK
  // -------------------------------------------------------

  /**
   * Lekéri a user Google OAuth access tokenjét.
   */
  async function getGoogleAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.provider_token || null;
  }

  /**
   * TripLog root folder ID lekérése / létrehozása.
   */
  async function ensureTripLogRootFolder(accessToken: string): Promise<string> {
    // 1) Keresés a Drive-ban: van-e már TripLog nevű mappa?
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=" +
        encodeURIComponent(`name='TripLog' and mimeType='application/vnd.google-apps.folder' and trashed=false`) +
        "&fields=files(id,name)",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchJson = await searchRes.json();
    if (searchJson.files && searchJson.files.length > 0) {
      return searchJson.files[0].id; // megvan a root
    }

    // 2) Ha nincs → létrehozás
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "TripLog",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    const createJson = await createRes.json();
    return createJson.id;
  }

  /**
   * Utazás saját mappájának létrehozása.
   */
  async function createTripFolder(
    rootFolderId: string,
    accessToken: string,
    tripTitle: string,
    dateFrom: string,
    dateTo: string
  ): Promise<string> {
    const folderName = buildTripFolderName({
      title: tripTitle,
      dateFrom,
      dateTo,
    });

    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    });

    const json = await res.json();
    return json.id;
  }

  /**
   * Placeholder TXT létrehozása a mappában.
   */
  async function createPlaceholderTxt(
    folderId: string,
    accessToken: string,
    tripTitle: string
  ) {
    const welcomeText = `
Üdvözöl a TripLog!

A(z) "${tripTitle}" utazásodhoz ez a mappa automatikusan jött létre.
Itt találod majd a feltöltött fotókat, dokumentumokat, és minden más fontos fájlt.

A TripLog segít az utazásod tervezésében, dokumentálásában és költségeinek rögzítésében – mindezt biztonságosan a saját Google Drive-odon.

Kellemes utazást és sok szép élményt kívánunk!
– A TripLog
    `.trim();

    const metadata = {
      name: "triplog_info.txt",
      mimeType: "text/plain",
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", new Blob([welcomeText], { type: "text/plain" }));

    await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );
  }

  // -------------------------------------------------------
  // AUTÓMATIKUS DRIVE MAPPALÉTREHOZÁS UTazás INSERT UTÁN
  // -------------------------------------------------------

  async function createTripAndFolder() {
    try {
      setLoading(true);

      // --- 1) User lekérése
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Nincs bejelentkezve.");
        return;
      }

      // --- 2) Utazás létrehozása Supabase-ben
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: user.id,
          title,
          destination: destination || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        })
        .select()
        .single();

      if (tripError) throw tripError;

      // --- 3) Auth token Drive-hoz
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        console.warn("No Google OAuth token – cannot create Drive folder.");
        // tovább lépünk, utazást ettől még létrehoztuk
        router.push(`/trip/${tripData.id}`);
        return;
      }

      // --- 4) TripLog root folder biztosítása
      const rootFolderId = await ensureTripLogRootFolder(accessToken);

      // --- 5) Utazás mappa létrehozása
      const tripFolderId = await createTripFolder(
        rootFolderId,
        accessToken,
        title,
        dateFrom,
        dateTo
      );

      // --- 6) Placeholder TXT létrehozása
      await createPlaceholderTxt(tripFolderId, accessToken, title);

      // --- 7) drive_folder_id mentése
      await supabase
        .from("trips")
        .update({ drive_folder_id: tripFolderId })
        .eq("id", tripData.id);

      // --- 8) Redirect
      router.push(`/trip/${tripData.id}`);
    } catch (err) {
      console.error("Trip creation failed:", err);
      alert("Hiba történt az utazás és/vagy Drive mappa létrehozása közben.");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center text-sm text-slate-600 hover:text-slate-800"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Vissza
      </button>

      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Új utazás</h1>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Utazás címe"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-2"
        />

        <input
          type="text"
          placeholder="Úticél (opcionális)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-2"
        />

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-slate-500">Kezdés</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-slate-500">Vége</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2"
            />
          </div>
        </div>

        <button
          disabled={loading}
          onClick={createTripAndFolder}
          className="w-full rounded-xl bg-emerald-600 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          {loading ? "Mentés..." : "Utazás létrehozása"}
        </button>
      </div>
    </div>
  );
}
