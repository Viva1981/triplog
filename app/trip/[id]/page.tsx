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
  notes: string | null;
  drive_folder_id: string | null;
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

type TripFile = {
  id: string;
  type: "photo" | "document";
  name: string;
  drive_file_id: string;
  thumbnail_link: string | null;
  preview_link: string | null;
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

// Google Drive megosztási linkből file ID kiszedése
function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url);
    const idParam = u.searchParams.get("id");
    if (idParam) return idParam;

    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];

    return null;
  } catch {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    return null;
  }
}

// Trip mappa neve: 251115 - Miskolc Magyarország
function buildTripFolderName(trip: Trip): string {
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
async function getOrCreateTripLogRootFolder(
  accessToken: string
): Promise<string> {
  const baseUrl = "https://www.googleapis.com/drive/v3/files";

  // keresés: TripLog mappa a rootban
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

  // ha nincs, létrehozás
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
function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();

  // Dinamikus route param biztonságos kinyerése
  const rawTripId = params?.id;
  const tripId =
    typeof rawTripId === "string"
      ? rawTripId
      : Array.isArray(rawTripId)
      ? rawTripId[0]
      : undefined;

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Jegyzet állapot
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);

  // Költségek állapot
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  // Új költség űrlap
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("EUR");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);

  // Fájlok állapot
  const [photoFiles, setPhotoFiles] = useState<TripFile[]>([]);
  const [docFiles, setDocFiles] = useState<TripFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Új fotó űrlap (linkes)
  const [photoName, setPhotoName] = useState("");
  const [photoLink, setPhotoLink] = useState("");
  const [submittingPhoto, setSubmittingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Új dokumentum űrlap (linkes)
  const [docName, setDocName] = useState("");
  const [docLink, setDocLink] = useState("");
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [docSuccess, setDocSuccess] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

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

  // Trip betöltése – single() nélkül, hogy ne dobjon 406-ot
  useEffect(() => {
    const fetchTrip = async () => {
      if (!tripId) {
        setError("Érvénytelen utazás azonosító.");
        setLoadingTrip(false);
        return;
      }

      setLoadingTrip(true);
      setError(null);

      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
        .eq("id", tripId);

      if (error) {
        console.error("TRIP FETCH ERROR:", error);
        setError(
          error.message ??
            "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."
        );
        setTrip(null);
      } else if (!data || data.length === 0) {
        setError(
          "Nem található ez az utazás, vagy nincs jogosultságod a megtekintéséhez."
        );
        setTrip(null);
      } else {
        const tripData = data[0] as Trip;
        setTrip(tripData);
        setNoteInput(tripData.notes ?? "");
      }

      setLoadingTrip(false);
    };

    if (!loadingUser) {
      fetchTrip();
    }
  }, [tripId, loadingUser]);

  // Költségek betöltése
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!tripId || !user) {
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
  }, [tripId, user, trip]);

  // Fájlok betöltése
  useEffect(() => {
    const fetchFiles = async () => {
      if (!tripId || !user) {
        setPhotoFiles([]);
        setDocFiles([]);
        return;
      }

      setLoadingFiles(true);
      setFilesError(null);

      const { data, error } = await supabase
        .from("trip_files")
        .select(
          "id, type, name, drive_file_id, thumbnail_link, preview_link"
        )
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("FILES FETCH ERROR:", error);
        setFilesError(error.message ?? "Nem sikerült betölteni a fájlokat.");
      } else {
        const all = (data ?? []) as TripFile[];
        setPhotoFiles(all.filter((f) => f.type === "photo"));
        setDocFiles(all.filter((f) => f.type === "document"));
      }

      setLoadingFiles(false);
    };

    if (user && trip) {
      fetchFiles();
    }
  }, [tripId, user, trip]);

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
      const parsedAmount = parseFloat(expenseAmount.replace(",", "."));
      if (isNaN(parsedAmount)) {
        setExpensesError("Érvénytelen összeg.");
        setSubmittingExpense(false);
        return;
      }

      const { data, error } = await supabase
        .from("trip_expenses")
        .insert({
          trip_id: trip.id,
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
        setExpenses((prev) => [...prev, data as Expense]);
        setExpenseSuccess("Költség sikeresen rögzítve.");
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

  const handleNoteSave = async () => {
    if (!trip) return;
    setSavingNote(true);
    setNoteError(null);
    setNoteSuccess(null);

    try {
      const { error } = await supabase
        .from("trips")
        .update({ notes: noteInput })
        .eq("id", trip.id);

      if (error) {
        console.error("NOTE UPDATE ERROR:", error);
        setNoteError(error?.message ?? "Nem sikerült elmenteni a jegyzetet.");
      } else {
        setNoteSuccess("Jegyzet elmentve.");
      }
    } catch (err: any) {
      console.error("NOTE SAVE ERROR:", err);
      setNoteError(err?.message ?? "Ismeretlen hiba történt.");
    } finally {
      setSavingNote(false);
    }
  };
  // Trip-hez tartozó Drive mappa biztosítása (TripLog / YYMMDD - Dest)
  const ensureTripFolder = async (accessToken: string): Promise<string> => {
    if (!trip) {
      throw new Error("Nincs utazás betöltve.");
    }
    if (!user) {
      throw new Error("Nincs bejelentkezett felhasználó.");
    }

    const isOwner = user.id === trip.owner_id;
    let folderId = trip.drive_folder_id ?? null;

    // Ha NEM owner a user
    if (!isOwner) {
      // Ha még nincs mappa ID, akkor nem hozhat létre sajátot,
      // mert az utazás mappája mindig az owner Drive-ján éljen.
      if (!folderId) {
        throw new Error(
          "Ehhez az utazáshoz még nincs Drive mappa. " +
            "Kérd meg az utazás tulajdonosát, hogy töltsön fel először egy fotót vagy dokumentumot."
        );
      }

      // Ha van ID, megnézzük, hogy a jelenlegi user eléri-e
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!checkRes.ok) {
        const txt = await checkRes.text();
        console.error("DRIVE FOLDER CHECK (NON-OWNER) ERROR:", txt);
        throw new Error(
          "Nincs jogosultságod az utazás Google Drive mappájához. " +
            "Kérd meg az utazás tulajdonosát, hogy ossza meg veled a mappát."
        );
      }

      // Mappa elérhető, használhatjuk
      return folderId;
    }

    // INNENTŐL: OWNER LOGIKA

    // Ha van eltárolt mappa ID, ellenőrizzük, hogy még létezik-e
    if (folderId) {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (checkRes.status === 404) {
        console.warn("TRIP FOLDER GONE, RECREATING AS OWNER...");
        folderId = null;
      } else if (!checkRes.ok) {
        const txt = await checkRes.text();
        console.error("DRIVE FOLDER CHECK (OWNER) ERROR:", txt);
        throw new Error(
          "Nem sikerült elérni az utazás Google Drive mappáját. " +
            "Próbáld meg újra, vagy ellenőrizd a Drive jogosultságokat."
        );
      }
    }

    // Ha nincs (vagy már nem létező) mappa ID, létrehozzuk az OWNER Drive-ján
    if (!folderId) {
      const rootId = await getOrCreateTripLogRootFolder(accessToken);
      const baseUrl = "https://www.googleapis.com/drive/v3/files";
      const folderName = buildTripFolderName(trip);

      // megpróbáljuk megkeresni a TripLog mappán belül
      const query = encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${rootId}' in parents and trashed=false`
      );

      const searchRes = await fetch(
        `${baseUrl}?q=${query}&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id as string;
      } else {
        // ha nincs, létrehozzuk
        const createRes = await fetch(baseUrl, {
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

        if (!createRes.ok) {
          const txt = await createRes.text();
          console.error("TRIP FOLDER CREATE ERROR:", txt);
          throw new Error(
            "Nem sikerült létrehozni az utazás mappáját a Drive-on."
          );
        }

        const created = await createRes.json();
        if (!created.id) {
          throw new Error(
            "Nem sikerült létrehozni az utazás mappáját a Drive-on."
          );
        }

        folderId = created.id as string;
      }

      // mappa ID mentése a trips táblába + state frissítés (OWNER-ként)
      const { error } = await supabase
        .from("trips")
        .update({ drive_folder_id: folderId })
        .eq("id", trip.id);

      if (error) {
        console.error("TRIP FOLDER UPDATE ERROR:", error);
      }

      setTrip((prev) =>
        prev ? { ...prev, drive_folder_id: folderId } : prev
      );
    }

    return folderId;
  };

  // Feltöltés Drive-ra + trip_files mentés
  const uploadFileToDriveAndSave = async (
    type: "photo" | "document",
    file: File
  ) => {
    if (!user || !trip) return;

    if (type === "photo") {
      setPhotoError(null);
      setPhotoSuccess(null);
      setSubmittingPhoto(true);
    } else {
      setDocError(null);
      setDocSuccess(null);
      setSubmittingDoc(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.provider_token as string | undefined;
      if (!accessToken) {
        throw new Error(
          "Nem érhető el a Google hozzáférési token. Jelentkezz ki, majd be újra."
        );
      }

      // Trip mappa biztosítása
      const folderId = await ensureTripFolder(accessToken);

      // multipart feltöltés
      const boundary = "-------314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: file.name,
        parents: [folderId],
      };

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${
          file.type || "application/octet-stream"
        }\r\n` +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        base64Data +
        closeDelimiter;

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,thumbnailLink,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        console.error("DRIVE UPLOAD ERROR:", txt);
        throw new Error("Nem sikerült feltölteni a fájlt a Google Drive-ra.");
      }

      const uploaded = await uploadRes.json();
      const fileId = uploaded.id as string;
      const thumb =
        (uploaded.thumbnailLink as string | undefined | null) ?? null;
      const webView =
        (uploaded.webViewLink as string | undefined | null) ??
        `https://drive.google.com/file/d/${fileId}/view`;

      const displayName = getBaseName(file.name);

      const { data, error } = await supabase
        .from("trip_files")
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          type,
          drive_file_id: fileId,
          name: displayName,
          mime_type: file.type || null,
          thumbnail_link: thumb,
          preview_link: webView,
        })
        .select(
          "id, type, name, drive_file_id, thumbnail_link, preview_link"
        )
        .single();

      if (error || !data) {
        console.error("TRIP_FILES INSERT ERROR:", error);
        throw new Error("A fájl feltöltése sikerült, de az app mentése nem.");
      }

      const newFile = data as TripFile;
      if (type === "photo") {
        setPhotoFiles((prev) => [...prev, newFile]);
        setPhotoSuccess("Fotó sikeresen feltöltve a Drive-ra.");
      } else {
        setDocFiles((prev) => [...prev, newFile]);
        setDocSuccess("Dokumentum sikeresen feltöltve a Drive-ra.");
      }
    } catch (err: any) {
      console.error("UPLOAD AND SAVE ERROR:", err);
      if (type === "photo") {
        setPhotoError(err?.message ?? "Ismeretlen hiba történt.");
      } else {
        setDocError(err?.message ?? "Ismeretlen hiba történt.");
      }
    } finally {
      if (type === "photo") setSubmittingPhoto(false);
      else setSubmittingDoc(false);
    }
  };

  // Linkes fájl hozzáadása (a régi logika)
  const handleAddFile = async (type: "photo" | "document") => {
    if (!user || !trip) return;

    if (type === "photo") {
      setPhotoError(null);
      setPhotoSuccess(null);
      if (!photoName.trim() || !photoLink.trim()) {
        setPhotoError("Név és Drive link megadása kötelező.");
        return;
      }
    } else {
      setDocError(null);
      setDocSuccess(null);
      if (!docName.trim() || !docLink.trim()) {
        setDocError("Név és Drive link megadása kötelező.");
        return;
      }
    }

    const rawLink = type === "photo" ? photoLink.trim() : docLink.trim();
    const name = type === "photo" ? photoName.trim() : docName.trim();

    const fileId = extractDriveFileId(rawLink);
    if (!fileId) {
      if (type === "photo") {
        setPhotoError("Nem sikerült értelmezni a Drive linket.");
      } else {
        setDocError("Nem sikerült értelmezni a Drive linket.");
      }
      return;
    }

    const thumbnail = `https://drive.google.com/thumbnail?&id=${fileId}`;
    const preview = `https://drive.google.com/file/d/${fileId}/view`;

    if (type === "photo") setSubmittingPhoto(true);
    else setSubmittingDoc(true);

    try {
      const { data, error } = await supabase
        .from("trip_files")
        .insert({
          trip_id: trip.id,
          user_id: user.id,
          type,
          drive_file_id: fileId,
          name,
          mime_type: null,
          thumbnail_link: thumbnail,
          preview_link: preview,
        })
        .select(
          "id, type, name, drive_file_id, thumbnail_link, preview_link"
        )
        .single();

      if (error || !data) {
        console.error("FILE INSERT ERROR:", error);
        if (type === "photo") {
          setPhotoError(error?.message ?? "Nem sikerült elmenteni a fotót.");
        } else {
          setDocError(
            error?.message ?? "Nem sikerült elmenteni a dokumentumot."
          );
        }
      } else {
        const newFile = data as TripFile;
        if (type === "photo") {
          setPhotoFiles((prev) => [...prev, newFile]);
          setPhotoSuccess("Fotó sikeresen hozzáadva.");
          setPhotoName("");
          setPhotoLink("");
        } else {
          setDocFiles((prev) => [...prev, newFile]);
          setDocSuccess("Dokumentum sikeresen hozzáadva.");
          setDocName("");
          setDocLink("");
        }
      }
    } catch (err: any) {
      console.error("FILE ADD ERROR:", err);
      if (type === "photo") {
        setPhotoError(err?.message ?? "Ismeretlen hiba történt.");
      } else {
        setDocError(err?.message ?? "Ismeretlen hiba történt.");
      }
    } finally {
      if (type === "photo") setSubmittingPhoto(false);
      else setSubmittingDoc(false);
    }
  };

  const handleDeleteFile = async (fileId: string, type: "photo" | "document") => {
    if (!confirm("Biztosan törlöd ezt az elemet?")) return;

    try {
      const { error } = await supabase
        .from("trip_files")
        .delete()
        .eq("id", fileId);

      if (error) {
        console.error("FILE DELETE ERROR:", error);
        if (type === "photo") {
          setPhotoError(error?.message ?? "Nem sikerült törölni a fotót.");
        } else {
          setDocError(
            error?.message ?? "Nem sikerült törölni a dokumentumot."
          );
        }
      } else {
        if (type === "photo") {
          setPhotoFiles((prev) => prev.filter((f) => f.id !== fileId));
        } else {
          setDocFiles((prev) => prev.filter((f) => f.id !== fileId));
        }
      }
    } catch (err: any) {
      console.error("FILE DELETE ERROR:", err);
      if (type === "photo") {
        setPhotoError(err?.message ?? "Ismeretlen hiba történt.");
      } else {
        setDocError(err?.message ?? "Ismeretlen hiba történt.");
      }
    }
  };

  const handleRenameFile = async (file: TripFile) => {
    const newName = prompt("Új név:", file.name);
    if (!newName || newName.trim() === "" || newName === file.name) return;

    try {
      const { error } = await supabase
        .from("trip_files")
        .update({ name: newName.trim() })
        .eq("id", file.id);

      if (error) {
        console.error("FILE RENAME ERROR:", error);
        if (file.type === "photo") {
          setPhotoError(
            error?.message ?? "Nem sikerült átnevezni a fotót."
          );
        } else {
          setDocError(
            error?.message ?? "Nem sikerült átnevezni a dokumentumot."
          );
        }
      } else {
        if (file.type === "photo") {
          setPhotoFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, name: newName.trim() } : f
            )
          );
        } else {
          setDocFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, name: newName.trim() } : f
            )
          );
        }
      }
    } catch (err: any) {
      console.error("FILE RENAME ERROR:", err);
      if (file.type === "photo") {
        setPhotoError(err?.message ?? "Ismeretlen hiba történt.");
      } else {
        setDocError(err?.message ?? "Ismeretlen hiba történt.");
      }
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

  const totalAmount = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const mainCurrency = expenses[0]?.currency || expenseCurrency || "";

  const categoryTotals = (() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const key = e.category?.trim() || "Egyéb";
      map.set(key, (map.get(key) ?? 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  })();

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

        {/* Szekciók – fotók, dokumentumok, jegyzet, költségek */}
        <section className="grid gap-4 md:grid-cols-2 mb-4">
          {/* Fotók */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Fotók</h2>
            <p className="text-xs text-slate-500 mb-2">
              Töltsd fel a képeket a saját Google Drive-odra, vagy töltsd fel
              közvetlenül az eszközödről – mi elmentjük a TripLog mappádba.
            </p>

            <div className="space-y-2 mb-3">
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                placeholder="Kép neve (pl.: Tengerpart naplemente)"
                value={photoName}
                onChange={(e) => {
                  setPhotoName(e.target.value);
                  setPhotoError(null);
                  setPhotoSuccess(null);
                }}
              />
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                placeholder="Google Drive megosztási link (opcionális)"
                value={photoLink}
                onChange={(e) => {
                  setPhotoLink(e.target.value);
                  setPhotoError(null);
                  setPhotoSuccess(null);
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleAddFile("photo")}
                  disabled={submittingPhoto}
                  className="flex-1 py-1.5 px-3 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition text-xs"
                >
                  {submittingPhoto ? "Mentés..." : "Fotó hozzáadása linkkel"}
                </button>

                <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-center cursor-pointer hover:bg-slate-50">
                  {submittingPhoto ? "Feltöltés..." : "Feltöltés eszközről"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFileToDriveAndSave("photo", file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>

              {photoError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
                  {photoError}
                </div>
              )}
              {photoSuccess && (
                <div className="text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
                  {photoSuccess}
                </div>
              )}
            </div>

            {loadingFiles && (
              <p className="text-[11px] text-slate-500">
                Fotók betöltése...
              </p>
            )}

            {filesError && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1 mb-2">
                {filesError}
              </div>
            )}

            {!loadingFiles && photoFiles.length === 0 && (
              <p className="text-[11px] text-slate-500">
                Még nincs egyetlen fotó sem ehhez az utazáshoz.
              </p>
            )}

            {!loadingFiles && photoFiles.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {photoFiles.map((file) => (
                  <div
                    key={file.id}
                    className="border border-slate-200 rounded-xl p-1.5 flex flex-col text-[11px]"
                  >
                    <a
                      href={file.preview_link || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block mb-1"
                    >
                      {file.thumbnail_link ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbnail_link}
                          alt={file.name}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-slate-100 rounded-lg">
                          Nincs előnézet
                        </div>
                      )}
                    </a>
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">{file.name}</p>
                    </div>
                    <div className="mt-1 flex justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => handleRenameFile(file)}
                        className="text-[10px] text-slate-500 underline"
                      >
                        Átnevezés
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id, "photo")}
                        className="text-[10px] text-red-500 underline"
                      >
                        Törlés
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dokumentumok */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Dokumentumok</h2>
            <p className="text-xs text-slate-500 mb-2">
              Foglalások, beszállókártyák, jegyek – töltsd fel Drive-ra
              közvetlenül az eszközödről, vagy illeszd be a megosztási linket.
            </p>

            <div className="space-y-2 mb-3">
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                placeholder="Dokumentum neve (pl.: Repülőjegy PDF)"
                value={docName}
                onChange={(e) => {
                  setDocName(e.target.value);
                  setDocError(null);
                  setDocSuccess(null);
                }}
              />
              <input
                type="text"
                className="w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
                placeholder="Google Drive megosztási link (opcionális)"
                value={docLink}
                onChange={(e) => {
                  setDocLink(e.target.value);
                  setDocError(null);
                  setDocSuccess(null);
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleAddFile("document")}
                  disabled={submittingDoc}
                  className="flex-1 py-1.5 px-3 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition text-xs"
                >
                  {submittingDoc ? "Mentés..." : "Dokumentum hozzáadása linkkel"}
                </button>

                <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-center cursor-pointer hover:bg-slate-50">
                  {submittingDoc ? "Feltöltés..." : "Feltöltés eszközről"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadFileToDriveAndSave("document", file);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>

              {docError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
                  {docError}
                </div>
              )}
              {docSuccess && (
                <div className="text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
                  {docSuccess}
                </div>
              )}
            </div>

            {!loadingFiles && docFiles.length === 0 && (
              <p className="text-[11px] text-slate-500">
                Még nincs egyetlen dokumentum sem ehhez az utazáshoz.
              </p>
            )}

            {!loadingFiles && docFiles.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {docFiles.map((file) => (
                  <div
                    key={file.id}
                    className="border border-slate-200 rounded-xl p-2 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex-1 mr-2">
                      <p className="font-medium line-clamp-2">{file.name}</p>
                      <a
                        href={file.preview_link || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#16ba53] underline"
                      >
                        Megnyitás Drive-ban
                      </a>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleRenameFile(file)}
                        className="text-[10px] text-slate-500 underline"
                      >
                        Átnevezés
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id, "document")}
                        className="text-[10px] text-red-500 underline"
                      >
                        Törlés
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jegyzet */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Jegyzet</h2>
            <p className="text-xs text-slate-500 mb-2">
              Ide írhatod az utazás terveit, emlékeket, fontos információkat.
            </p>

            <textarea
              className="w-full border rounded-xl px-3 py-2 text-xs min-h-[120px] focus:outline-none focus:ring-1 focus:ring-[#16ba53]"
              placeholder="Pl.: Érkezés 14:00-kor, találkozó a reptéren, első nap városnézés..."
              value={noteInput}
              onChange={(e) => {
                setNoteInput(e.target.value);
                setNoteError(null);
                setNoteSuccess(null);
              }}
            />

            {noteError && (
              <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
                {noteError}
              </div>
            )}

            {noteSuccess && (
              <div className="mt-2 text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
                {noteSuccess}
              </div>
            )}

            <button
              type="button"
              onClick={handleNoteSave}
              disabled={savingNote}
              className="mt-2 w-full py-1.5 px-3 rounded-xl font-medium bg-[#16ba53] text-white hover:opacity-90 disabled:opacity-60 transition text-xs"
            >
              {savingNote ? "Mentés..." : "Jegyzet mentése"}
            </button>
          </div>

          {/* Költségek – űrlap + lista */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Költségek</h2>
            <p className="text-xs text-slate-500 mb-3">
              Itt tudod rögzíteni, hogy ki mit fizetett az utazás során.
            </p>

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
                  Összesen: {totalAmount.toFixed(2)} {mainCurrency}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Költségek statisztika – szöveges összefoglaló */}
        <section className="mt-4">
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">
              Költségek statisztika
            </h2>

            {expenses.length === 0 && (
              <p className="text-xs text-slate-500">
                Még nincs elég adat a statisztikához. Rögzíts néhány költséget!
              </p>
            )}

            {expenses.length > 0 && (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Összes költés:{" "}
                  <span className="font-semibold">
                    {totalAmount.toFixed(2)} {mainCurrency}
                  </span>
                </p>

                <div className="space-y-1 text-xs">
                  {categoryTotals.map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between border-b border-slate-100 py-1"
                    >
                      <span className="text-slate-600">{cat.name}</span>
                      <span className="font-semibold">
                        {cat.value.toFixed(2)} {mainCurrency}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-[11px] text-slate-400">
                  A kategóriák a rögzített költségek „Kategória” mezője alapján
                  számolódnak. Ha több pénznemet használsz, az összesítés csak
                  közelítő.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
