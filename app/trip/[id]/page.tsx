"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import TripHeader from "./TripHeader";

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

// Fájlnévből levesszük a kiterjesztést
function getBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();

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

  // Fotó / dokumentum feltöltés állapot
  const [submittingPhoto, setSubmittingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
        router.push("/");
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
        .select(
          "id, owner_id, title, destination, date_from, date_to, notes, drive_folder_id"
        )
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
        const tripData = data as Trip;
        setTrip(tripData);
        setNoteInput(tripData.notes ?? "");
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

  // Fájlok betöltése
  useEffect(() => {
    const fetchFiles = async () => {
      const tripId = params?.id;
      if (!tripId || Array.isArray(tripId) || !user) {
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
        setFilesError(
          error.message ?? "Nem sikerült betölteni a fájlokat."
        );
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
        setNoteError(
          error?.message ?? "Nem sikerült elmenteni a jegyzetet."
        );
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

  // Trip-hez tartozó Drive mappa biztosítása
  const ensureTripFolder = async (accessToken: string): Promise<string> => {
    if (!trip) {
      throw new Error("Nincs utazás betöltve.");
    }

    let folderId = trip.drive_folder_id ?? null;

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
        console.warn("TRIP FOLDER GONE, RECREATING...");
        folderId = null;
      } else if (!checkRes.ok) {
        const txt = await checkRes.text();
        console.error("DRIVE FOLDER CHECK ERROR:", txt);
        throw new Error(
          "Nincs elég jogosultság a Google Drive mappa eléréséhez. Próbáld meg eltávolítani az app hozzáférését a Google fiókodból, majd újra bejelentkezni."
        );
      }
    }

    if (!folderId) {
      const rootId = await getOrCreateTripLogRootFolder(accessToken);
      const baseUrl = "https://www.googleapis.com/drive/v3/files";
      const folderName = buildTripFolderName(trip);

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

      const folderId = await ensureTripFolder(accessToken);

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

  const handleDeleteFile = async (
    fileId: string,
    type: "photo" | "document",
    driveFileId?: string
  ) => {
    if (!user) return;

    const file =
      type === "photo"
        ? photoFiles.find((f) => f.id === fileId)
        : docFiles.find((f) => f.id === fileId);

    if (!file) return;

    const confirmed = confirm("Biztosan törlöd ezt a fájlt?");
    if (!confirmed) return;

    if (type === "photo") {
      setPhotoError(null);
    } else {
      setDocError(null);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.provider_token as string | undefined;

      if (accessToken) {
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!driveRes.ok && driveRes.status !== 404) {
          if (driveRes.status === 403 || driveRes.status === 401) {
            const msg =
              "Ezt a fájlt valószínűleg egy másik utazó hozta létre. Csak ő vagy a Google Drive felületén tudja törölni.";
            if (type === "photo") {
              setPhotoError(msg);
            } else {
              setDocError(msg);
            }
            return;
          }

          const txt = await driveRes.text().catch(() => "");
          console.error("DRIVE DELETE ERROR:", driveRes.status, txt);

          const msg =
            "Nem sikerült törölni a fájlt a Google Drive-ról. Próbáld meg később, vagy töröld közvetlenül a Drive felületén.";
          if (type === "photo") {
            setPhotoError(msg);
          } else {
            setDocError(msg);
          }
          return;
        }
      }

      const { error } = await supabase
        .from("trip_files")
        .delete()
        .eq("id", fileId);

      if (error) {
        console.error("FILE DELETE ERROR:", error);
        const msg = "Nem sikerült törölni a fájlt az alkalmazásból.";
        if (type === "photo") {
          setPhotoError(error.message ?? msg);
        } else {
          setDocError(error.message ?? msg);
        }
        return;
      }

      if (type === "photo") {
        setPhotoFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        setDocFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err: any) {
      console.error("FILE DELETE UNEXPECTED ERROR:", err);
      const msg =
        err?.message ??
        "Ismeretlen hiba történt törlés közben. Próbáld újra később.";
      if (type === "photo") {
        setPhotoError(msg);
      } else {
        setDocError(msg);
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

  const isOwner = !!(user && trip && user.id === trip.owner_id);

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

  const maxCategoryValue =
    categoryTotals.reduce((max, c) => Math.max(max, c.value), 0) || 0;

  const handleScrollToStats = () => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("trip-stats");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
        <TripHeader
          trip={trip}
          user={user}
          from={from}
          to={to}
          isOwner={!!isOwner}
          onScrollToStats={handleScrollToStats}
        />


        {/* Szekciók – fotók, dokumentumok, jegyzet, költségek */}
        <section className="grid gap-4 md:grid-cols-2 mb-4">
          {/* Fotók */}
          <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
            <h2 className="text-sm font-semibold mb-2">Fotók</h2>
            <p className="text-xs text-slate-500 mb-3">
              Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
              automatikusan elmenti őket az utazás Google Drive mappájába.
            </p>

            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-center cursor-pointer hover:opacity-90 transition font-medium">
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
                        onClick={() =>
                          handleDeleteFile(file.id, "photo", file.drive_file_id)
                        }
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
            <p className="text-xs text-slate-500 mb-3">
              Foglalások, beszállókártyák, jegyek és más fontos dokumentumok –
              töltsd fel őket közvetlenül az eszközödről, mi elmentjük az
              utazás mappájába.
            </p>

            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-center cursor-pointer hover:opacity-90 transition font-medium">
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
                        onClick={() =>
                          handleDeleteFile(
                            file.id,
                            "document",
                            file.drive_file_id
                          )
                        }
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

        {/* Költségek statisztika – csinosított szekció */}
        <section id="trip-stats" className="mt-4">
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
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#16ba53]/10 text-[#16ba53] font-semibold">
                    Összes költés:{" "}
                    <span className="ml-1">
                      {totalAmount.toFixed(2)} {mainCurrency}
                    </span>
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    Kategóriák száma:{" "}
                    <span className="ml-1">{categoryTotals.length}</span>
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {categoryTotals.map((cat) => {
                    const ratio = maxCategoryValue
                      ? cat.value / maxCategoryValue
                      : 0;
                    const width = Math.max(ratio * 100, 5); // hogy látszódjon a very small is

                    return (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-600">{cat.name}</span>
                          <span className="font-semibold">
                            {cat.value.toFixed(2)} {mainCurrency}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#16ba53]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-[11px] text-slate-400">
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
