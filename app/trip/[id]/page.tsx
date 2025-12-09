"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import TripHeader from "./TripHeader";
import PhotosSection from "./PhotosSection";
import DocumentsSection from "./DocumentsSection";
import NotesSection from "./NotesSection";
import ExpensesSection from "./ExpensesSection";
import { formatDate } from "../../../lib/trip/format";
import {
  buildTripFolderName,
  getBaseName,
  getOrCreateTripLogRootFolder,
} from "../../../lib/trip/drive";
import type { Trip, TripFile } from "../../../lib/trip/types";

type User = {
  id: string;
  email?: string;
};

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      }

      setLoadingTrip(false);
    };

    if (!loadingUser) {
      fetchTrip();
    }
  }, [params, loadingUser]);

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
          "id, type, user_id, name, drive_file_id, thumbnail_link, preview_link"
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
  }, [params, user, trip]);

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

  // Feltöltés Drive-ra + trip_files mentés (JAVÍTVA)
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

      // 🔧 ITT A FŐ FIX: webContentLink is kérve
      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,thumbnailLink,webViewLink,webContentLink",
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
      const webContent =
        (uploaded.webContentLink as string | undefined | null) ?? null;

      // 👉 EBBŐL LESZ A LIGHTBOX NAGY KÉP
      const previewUrl =
        webContent ||
        (file.type?.startsWith("image/")
          ? `https://lh3.googleusercontent.com/d/${fileId}=s2000`
          : webView);

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
          preview_link: previewUrl, // 👈 Itt már a jó URL megy be
        })
        .select(
          "id, type, user_id, name, drive_file_id, thumbnail_link, preview_link"
        )
        .single();

      if (error || !data) {
        console.error("TRIP_FILES INSERT ERROR:", error);
        throw new Error(
          "A fájl feltöltése sikerült, de az app mentése nem."
        );
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

  const handleScrollToExpenses = () => {
    const el = document.getElementById("expenses-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });

      const input = el.querySelector("input[name='category']");
      if (input) {
        setTimeout(() => {
          (input as HTMLInputElement).focus();
        }, 400);
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
          onScrollToExpenses={handleScrollToExpenses}
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
            currentUserId={user?.id ?? null}
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
            currentUserId={user?.id ?? null}
          />

          <NotesSection tripId={trip.id} initialNotes={trip.notes ?? null} />

          {/* IDE kerül az anchor, amire a TripHeader gomb scrolloz */}
          <div id="expenses-section">
            <ExpensesSection tripId={trip.id} userId={user?.id ?? null} />
          </div>
        </section>
      </div>
    </main>
  );
}
