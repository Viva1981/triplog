"use client";

import React from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./components/FileCard";

type PhotosSectionProps = {
  photoFiles: TripFile[];
  loadingFiles: boolean;
  filesError: string | null;
  submittingPhoto: boolean;
  photoError: string | null;
  photoSuccess: string | null;
  uploadFileToDriveAndSave: (
    type: "photo" | "document",
    file: File
  ) => Promise<void> | void;
  handleRenameFile: (file: TripFile) => Promise<void> | void;
  handleDeleteFile: (
    fileId: string,
    type: "photo" | "document",
    driveFileId?: string
  ) => Promise<void> | void;
  /** Jelenlegi user Supabase ID – ha megadod, csak a saját feltöltéseid szerkeszthetők. */
  currentUserId?: string | null;
};

export default function PhotosSection({
  photoFiles,
  loadingFiles,
  filesError,
  submittingPhoto,
  photoError,
  photoSuccess,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
  currentUserId,
}: PhotosSectionProps) {
  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("photo", file);
    event.target.value = "";
  };

  // Van-e olyan fotó, amit NEM a jelenlegi user töltött fel?
  const hasOtherUploader =
    !!currentUserId &&
    photoFiles.some(
      (file) => file.user_id && file.user_id !== currentUserId
    );

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      {/* Fejléc */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Fotók</h2>
          <p className="text-xs text-slate-500">
            Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
            automatikusan elmenti őket az utazás Google Drive mappájába.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
            disabled={submittingPhoto}
          />
          {submittingPhoto ? "Feltöltés..." : "Feltöltés"}
        </label>
      </div>

      {/* státusz üzenetek */}
      {photoError && (
        <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {photoError}
        </div>
      )}
      {photoSuccess && (
        <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {photoSuccess}
        </div>
      )}
      {filesError && (
        <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {filesError}
        </div>
      )}

      {/* lista */}
      {loadingFiles ? (
        <div className="mt-4 text-xs text-slate-500">Fotók betöltése...</div>
      ) : photoFiles.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Még nincs egyetlen fotó sem ehhez az utazáshoz.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {photoFiles.map((file) => {
              // Csak a feltöltő kezelheti – ha nincs currentUserId vagy user_id, akkor senki
              const canManage =
                !!currentUserId && !!file.user_id && file.user_id === currentUserId;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onRename={() => handleRenameFile(file)}
                  onDelete={() =>
                    handleDeleteFile(file.id, "photo", file.drive_file_id)
                  }
                />
              );
            })}
          </div>

          {hasOtherUploader && (
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              Csak az általad feltöltött fotókat tudod átnevezni vagy törölni
              az alkalmazásból. A többiek által feltöltött képek kezelése a
              Google Drive jogosultságaitól függ – ilyen esetben kérd meg az
              illetőt, hogy ő módosítsa vagy törölje a fájlt.
            </p>
          )}
        </>
      )}
    </section>
  );
}
