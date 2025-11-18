"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import TripHeader from "./TripHeader";
import PhotosSection from "./PhotosSection";
import DocumentsSection from "./DocumentsSection";
import NotesSection from "./NotesSection";
import ExpensesSection from "./ExpensesSection";
import StatsSection from "./StatsSection";

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
          <PhotosSection
            photoFiles={photoFiles}
            loadingFiles={loadingFiles}
            filesError={filesError}
            submittingPhoto={submittingPhoto}
            photoError={photoError}
            photoSuccess={photoSuccess}
            uploadFileToDriveAndSave={uploadFileToDriveAndSave}
            handleRenameFile={handleRenameFile}
            handleDeleteFile={handleDeleteFile}
          />

          <DocumentsSection
            docFiles={docFiles}
            loadingFiles={loadingFiles}
            filesError={filesError}
            submittingDoc={submittingDoc}
            docError={docError}
            docSuccess={docSuccess}
            uploadFileToDriveAndSave={uploadFileToDriveAndSave}
            handleRenameFile={handleRenameFile}
            handleDeleteFile={handleDeleteFile}
          />

          <ExpensesSection
            tripId={trip.id}
            userId={user?.id ?? null}
          />

      <StatsSection tripId={trip.id} />
     </div>
    </main>
  );
}
