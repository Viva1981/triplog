// lib/trip/driveSetup.ts

import { createClient } from "@/lib/supabaseClient";

/**
 * 1) Helyi helper a mappanévhez
 *    Pl. "2025-12-05 – Mályi"
 */
export function buildTripFolderNameLocal(params: {
  title: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const { title, dateFrom } = params;

  if (dateFrom && title) {
    return `${dateFrom} – ${title}`;
  }

  if (title) return title;

  return "TripLog utazás";
}

/**
 * 2) Felhasználó Google access tokenjének lekérése
 */
async function getGoogleAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.provider_token || null;
}

/**
 * 3) TripLog root folder biztosítása
 */
async function ensureTripLogRootFolder(accessToken: string): Promise<string> {
  // keresés
  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" +
      encodeURIComponent(
        "name='TripLog' and mimeType='application/vnd.google-apps.folder' and trashed=false"
      ) +
      "&fields=files(id,name)",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const searchJson = await searchRes.json();
  if (searchJson.files?.length > 0) {
    return searchJson.files[0].id;
  }

  // létrehozás
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
 * 4) Utazás mappájának létrehozása
 */
async function createTripFolder(
  rootId: string,
  accessToken: string,
  title: string,
  dateFrom: string,
  dateTo: string
): Promise<string> {
  const folderName = buildTripFolderNameLocal({
    title,
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
      parents: [rootId],
    }),
  });

  const json = await res.json();
  return json.id;
}

/**
 * 5) Placeholder üdvözlő TXT létrehozása
 */
async function createWelcomeTxtFile(
  folderId: string,
  accessToken: string,
  tripTitle: string
) {
  const text = `
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

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", new Blob([text], { type: "text/plain" }));

  await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );
}

/**
 * 6) FŐ FUNKCIÓ:
 * Utazás létrehozásakor automatikusan Drive mappa + TXT létrehozása
 */
export async function setupDriveForNewTrip(params: {
  tripId: string;
  title: string;
  dateFrom: string;
  dateTo: string;
}) {
  const { tripId, title, dateFrom, dateTo } = params;
  const supabase = createClient();

  // token
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    console.warn("No Google access token – skipping folder creation.");
    return;
  }

  // root
  const rootId = await ensureTripLogRootFolder(accessToken);

  // trip folder
  const folderId = await createTripFolder(
    rootId,
    accessToken,
    title,
    dateFrom,
    dateTo
  );

  // welcome TXT
  await createWelcomeTxtFile(folderId, accessToken, title);

  // folder ID mentése Supabase-be
  await supabase
    .from("trips")
    .update({ drive_folder_id: folderId })
    .eq("id", tripId);
}
