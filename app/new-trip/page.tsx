"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type User = {
  id: string;
  email?: string | null;
};

type Trip = {
  id: string;
  owner_id: string;
  title: string;
  destination: string | null;
  date_from: string | null;
  date_to: string | null;
  drive_folder_id?: string | null;
};

// Trip mappa neve: 251127 - Dabas
function buildTripFolderName(trip: Trip): string {
  let prefix = "000000";
  if (trip.date_from) {
    const d = new Date(trip.date_from);
    if (!isNaN(d.getTime())) {
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      prefix = `${yy}${mm}${dd}`;
    }
  }
  const dest = trip.destination || "Ismeretlen desztináció";
  return `${prefix} - ${dest}`;
}

// TripLog gyökér mappa lekérdezése / létrehozása
async function getOrCreateTripLogRootFolder(
  accessToken: string
): Promise<string> {
  const baseUrl = "https://www.googleapis.com/drive/v3/files";

  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.folder' and name='TripLog' and 'root' in parents and trashed=false"
  );

  const searchRes = await fetch(`${baseUrl}?q=${query}&fields=files(id,name)`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createRes = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "TripLog",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    }),
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    console.error("DRIVE ROOT FOLDER CREATE ERROR:", txt);
    throw new Error("Nem sikerült létrehozni a TripLog mappát a Drive-on.");
  }

  const created = await createRes.json();
  if (!created.id) {
    throw new Error("Nem sikerült létrehozni a TripLog mappát a Drive-on.");
  }

  return created.id as string;
}

// Trip mappa + eseménynapló létrehozása, drive_folder_id mentése
async function initializeTripDriveFolderAndLog(
  accessToken: string,
  trip: Trip
): Promise<void> {
  try {
    const rootId = await getOrCreateTripLogRootFolder(accessToken);
    const baseUrl = "https://www.googleapis.com/drive/v3/files";
    const folderName = buildTripFolderName(trip);

    // 1) Utazás mappa létrehozása a TripLog alatt
    const folderRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId],
      }),
    });

    if (!folderRes.ok) {
      const txt = await folderRes.text();
      console.error("TRIP FOLDER CREATE ERROR:", txt);
      throw new Error("Nem sikerült létrehozni az utazás mappáját a Drive-on.");
    }

    const folder = await folderRes.json();
    const folderId = folder.id as string | undefined;
    if (!folderId) {
      throw new Error("Nem sikerült elmenteni az utazás mappa azonosítóját.");
    }

    // 2) Eseménynapló (triplog-log.txt) létrehozása
    const nowIso = new Date().toISOString();
    const lines = [
      "Üdvözöl a TripLog eseménynapló! ✈️",
      "",
      `[${nowIso}] Utazás létrehozva: ${trip.title}`,
      `[${nowIso}] Eseménynapló létrehozva.`,
      "",
    ];
    const fileContent = lines.join("\n");

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: "triplog-log.txt",
      mimeType: "text/plain",
      parents: [folderId],
    };

    // Szöveg base64-re
    const base64Data = btoa(unescape(encodeURIComponent(fileContent)));

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: text/plain; charset=UTF-8\r\n" +
      "Content-Transfer-Encoding: base64\r\n" +
      "\r\n" +
      base64Data +
      closeDelimiter;

    const logRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!logRes.ok) {
      const txt = await logRes.text();
      console.error("TRIP LOG CREATE ERROR:", txt);
      // Nem dobjuk tovább, az utazás ettől még működjön
    } else {
      await logRes.json(); // jelenleg nem használjuk az ID-t
    }

    // 3) drive_folder_id mentése a trips táblába
    const { error: updateError } = await supabase
      .from("trips")
      .update({ drive_folder_id: folderId })
      .eq("id", trip.id);

    if (updateError) {
      console.error("TRIP FOLDER UPDATE ERROR:", updateError);
    }
  } catch (err) {
    console.error("INITIALIZE DRIVE FOLDER & LOG ERROR:", err);
    // Nem dobjuk tovább → az utazás létrejön, max. feltöltésnél újrapróbáljuk
  }
}

export default function NewTripPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setLoadingUser(false);
        router.push("/");
        return;
      }

      setUser({ id: user.id, email: user.email });
      setLoadingUser(false);
    };

    fetchUser();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setError("Az utazás címe kötelező.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1) Utazás létrehozása
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          destination: destination.trim() || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        })
        .select(
          "id, owner_id, title, destination, date_from, date_to, drive_folder_id"
        )
        .single();

      if (tripError || !tripData) {
        console.error("TRIP INSERT ERROR:", tripError);
        setError(
          tripError?.message ?? "Nem sikerült létrehozni az utazást."
        );
        setSubmitting(false);
        return;
      }

      const trip = tripData as Trip;

      // 2) Owner hozzáadása trip_members táblához
      const { error: memberError } = await supabase
        .from("trip_members")
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          role: "owner",
          status: "accepted",
        });

      if (memberError) {
        console.error("TRIP MEMBERS OWNER INSERT ERROR:", memberError);
        // nem állítjuk le emiatt, de logoljuk
      }

      // 3) Drive mappa + eseménynapló létrehozása (best-effort)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.provider_token as string | undefined;

        if (accessToken) {
          await initializeTripDriveFolderAndLog(accessToken, trip);
        } else {
          console.warn(
            "Nincs Google hozzáférési token trip létrehozáskor – Drive mappát feltöltéskor próbálunk létrehozni."
          );
        }
      } catch (driveErr) {
        console.error("DRIVE INIT ERROR:", driveErr);
      }

      // 4) Átirányítás az utazás részleteire
      router.push(`/trip/${trip.id}`);
    } catch (err: any) {
      console.error("NEW TRIP SUBMIT ERROR:", err);
      setError(err?.message ?? "Ismeretlen hiba történt.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Betöltés...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Átirányítás a bejelentkezéshez...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <span className="mr-1">←</span> Vissza az utazásaidhoz
          </Link>
        </div>

        <section className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
          <h1 className="text-xl font-bold mb-2">Új utazás létrehozása</h1>
          <p className="text-sm text-slate-600 mb-4">
            Adj meg egy címet, desztinációt és dátumokat. Az utazás
            létrehozásakor automatikusan létrehozunk egy saját Google Drive
            mappát és egy eseménynaplót is.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Utazás címe *
              </label>
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] focus:border-transparent"
                placeholder="Pl.: Dabas hétvége"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Desztináció
              </label>
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] focus:border-transparent"
                placeholder="Pl.: Dabas, Magyarország"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Kezdő dátum
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] focus:border-transparent"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Befejező dátum
                </label>
                <input
                  type="date"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53] focus:border-transparent"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 rounded-xl font-semibold bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition text-sm"
            >
              {submitting ? "Utazás létrehozása..." : "Utazás létrehozása"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
