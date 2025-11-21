"use client";

import React, { useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./components/FileCard";
import { motion, PanInfo } from "framer-motion";

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
  currentUserId?: string | null;
};

// Lightbox kép URL – próbáljunk nagyobb verziót előállítani
function getLightboxImageSrc(file: TripFile): string {
  if (file.thumbnail_link) {
    let url = file.thumbnail_link;

    // Google Drive thumbnail: ...googleusercontent.com...=s220 → s1600
    if (url.includes("googleusercontent.com")) {
      url = url.replace(/=s\d+(-c)?/, "=s1600");
    }

    return url;
  }

  // Végső fallback: preview_link (ha van)
  return file.preview_link || "";
}

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("photo", file);
    event.target.value = "";
  };

  const hasOtherUploader =
    !!currentUserId &&
    photoFiles.some(
      (file) => file.user_id && file.user_id !== currentUserId
    );

  const openLightbox = (index: number) => {
    if (photoFiles.length === 0) return;
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const showPrev = () => {
    if (lightboxIndex === null || photoFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === null
        ? null
        : prev === 0
        ? photoFiles.length - 1
        : prev - 1
    );
  };

  const showNext = () => {
    if (lightboxIndex === null || photoFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === null
        ? null
        : prev === photoFiles.length - 1
        ? 0
        : prev + 1
    );
  };

  const currentPhoto =
    lightboxIndex !== null ? photoFiles[lightboxIndex] : null;

  // 👉 swipe logika framer-motionhöz
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 80; // px – ennyinél döntjük el, hogy lapozunk-e

    if (info.offset.x > threshold) {
      // jobbra húzta → előző kép
      showPrev();
    } else if (info.offset.x < -threshold) {
      // balra húzta → következő kép
      showNext();
    }
  };

  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        {/* Fejléc */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fotók
            </h2>
            <p className="text-xs text-slate-500">
              Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
              automatikusan elmenti őket az utazás Google Drive mappájába.
            </p>
            {photoFiles.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                Összesen {photoFiles.length} fotó ehhez az utazáshoz.
              </p>
            )}
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

        {/* lista / állapot */}
        {loadingFiles ? (
          <div className="mt-4 text-xs text-slate-500">
            Fotók betöltése...
          </div>
        ) : photoFiles.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
            Még nincs egyetlen fotó sem ehhez az utazáshoz.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {photoFiles.map((file, index) => {
                const canManage =
                  !!currentUserId &&
                  !!file.user_id &&
                  file.user_id === currentUserId;

                return (
                  <FileCard
                    key={file.id}
                    file={file}
                    canManage={canManage}
                    onPreviewClick={() => openLightbox(index)}
                    onRename={() => handleRenameFile(file)}
                    onDelete={() =>
                      handleDeleteFile(
                        file.id,
                        "photo",
                        file.drive_file_id
                      )
                    }
                  />
                );
              })}
            </div>

            {hasOtherUploader && (
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Csak az általad feltöltött fotókat tudod átnevezni vagy
                törölni az alkalmazásból. A többiek által feltöltött képek
                kezelése a Google Drive jogosultságaitól függ – ilyen
                esetben kérd meg az illetőt, hogy ő módosítsa vagy törölje
                a fájlt.
              </p>
            )}
          </>
        )}
      </section>

      {/* LIGHTBOX / MODAL */}
      {currentPhoto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3">
          {/* háttér, kattintásra bezár */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <div className="relative z-50 max-h-[90vh] w-full max-w-3xl rounded-2xl bg-black/80 p-3 md:p-4">
            {/* Bezárás gomb csak desktopon */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 hidden rounded-full bg-black/60 px-2 py-1 text-xs text-slate-100 hover:bg-black md:inline-flex"
            >
              Bezárás
            </button>

            <div className="flex items-center justify-between gap-2">
              {/* desktop nyilak bal/jobb */}
              <button
                type="button"
                onClick={showPrev}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-slate-100 hover:bg-black md:flex"
              >
                ◀
              </button>

              {/* 👉 Swipe-elhető kép */}
              <motion.div
                className="flex-1"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                <img
                  src={getLightboxImageSrc(currentPhoto)}
                  alt={currentPhoto.name}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
                />
                {/* Név + index CSAK desktopon */}
                <div className="mt-2 hidden items-center justify-between text-[11px] text-slate-200 md:flex">
                  <span className="truncate pr-2">
                    {currentPhoto.name}
                  </span>
                  <span>
                    {lightboxIndex! + 1} / {photoFiles.length}
                  </span>
                </div>
              </motion.div>

              <button
                type="button"
                onClick={showNext}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-slate-100 hover:bg-black md:flex"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
