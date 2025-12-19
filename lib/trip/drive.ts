import type { Trip } from "./types";

// Trip mappa neve: 251115 - Miskolc Magyarország
export function buildTripFolderName(trip: Trip): string {
  let prefix = "000000";
  if (trip.date_from) {
    const d = new Date(trip.date_from);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    prefix = `${yy}${mm}${dd}`;
  }
  const dest = trip.destination || "Ismeretlen desztináció";
  return `${prefix} - ${dest}`;
}

// TripLog gyökér mappa lekérdezése / létrehozása
export async function getOrCreateTripLogRootFolder(
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

  // Ha nincs meg, létrehozzuk. (Alapból privát lesz, és ez a cél!)
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

// Fájlnévből levesszük a kiterjesztést
export function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}