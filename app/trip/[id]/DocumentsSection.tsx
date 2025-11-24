"use client";

import React, { useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";

type DocumentsSectionProps = {
  docFiles: TripFile[];
  loadingFiles: boolean;
  filesError: string | null;
  submittingDoc: boolean;
  docError: string | null;
  docSuccess: string | null;
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

// Lightbox kép URL doksikhoz – első oldal / preview
function getDocumentLightboxSrc(file: TripFile): string {
  if (file.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${file.drive_file_id}&sz=w1600`;
  }
  if (file.thumbnail_link) {
    return file.thumbnail_link;
  }
  return file.preview_link || "";
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  docFiles,
  loadingFiles,
  filesError,
  submittingDoc,
  docError,
  docSuccess,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
  currentUserId,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleDocChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("document", file);
    event.target.value = "";
  };

  const hasOtherUploader =
    !!currentUserId &&
    docFiles.some(
      (file) => file.user_id && file.user_id !== currentUserId
    );

  const openLightbox = (index: number) => {
    if (docFiles.length === 0) return;
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const showPrev = () => {
    if (lightboxIndex === null || docFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === null ? null : prev === 0 ? docFiles.length - 1 : prev - 1
    );
  };

  const showNext = () => {
    if (lightboxIndex === null || docFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === null
        ? null
        : prev === docFiles.length - 1
        ? 0
        : prev + 1
    );
  };

  const currentDoc =
    lightboxIndex !== null ? docFiles[lightboxIndex] : null;

  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        {/* Fejléc */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dokumentumok
            </h2>
            <p className="text-xs text-slate-500">
              Foglalások, beszállókártyák, jegyek és más fontos
              dokumentumok – töltsd fel őket közvetlenül az eszközödről,
              mi elmentjük az utazás Google Drive mappájába.
            </p>
            {docFiles.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                Összesen {docFiles.length} dokumentum.
              </p>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
            <input
              type="file"
              className="hidden"
              onChange={handleDocChange}
              disabled={submittingDoc}
            />
            {submittingDoc ? "Feltöltés..." : "Feltöltés"}
          </label>
        </div>

        {/* státusz üzenetek */}
        {docError && (
          <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {docError}
          </div>
        )}
        {docSuccess && (
          <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {docSuccess}
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
            Dokumentumok betöltése...
          </div>
        ) : docFiles.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
            Még nincs dokumentum ehhez az utazáshoz.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {docFiles.map((file, index) => {
                const canManage =
                  !!currentUserId &&
                  !!file.user_id &&
                  file.user_id === currentUserId;

                return (
                  <FileCard
                    key={file.id}
                    file={file}
                    canManage={canManage}
                    // Thumb-ra kattintás: lightbox galéria
                    onPreviewClick={() => openLightbox(index)}
                    // Kebab "Megnyitás"
                    onOpen={() => {
                      if (file.preview_link) {
                        window.open(
                          file.preview_link,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }
                    }}
                    onRename={() => handleRenameFile(file)}
                    onDelete={() =>
                      handleDeleteFile(
                        file.id,
                        "document",
                        file.drive_file_id
                      )
                    }
                  />
                );
              })}
            </div>

            {hasOtherUploader && (
              <p className="mt-3 text-[11px] leading-snug text-slate-500">
                Csak az általad feltöltött dokumentumokat tudod átnevezni
                vagy törölni az alkalmazásból. A többiek által feltöltött
                fájlok kezelése a Google Drive jogosultságaitól függ.
              </p>
            )}
          </>
        )}
      </section>

      {/* LIGHTBOX / GALÉRIA DOKSIKHOZ */}
      {currentDoc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3">
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <div className="relative z-50 max-h-[90vh] w-full max-w-3xl rounded-2xl bg-black/80 p-3 md:p-4">
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 hidden rounded-full bg-black/60 px-2 py-1 text-xs text-slate-100 hover:bg-black md:inline-flex"
            >
              Bezárás
            </button>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={showPrev}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-slate-100 hover:bg-black md:flex"
              >
                ◀
              </button>

              <div className="flex-1">
                <img
                  src={getDocumentLightboxSrc(currentDoc)}
                  alt={currentDoc.name}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain bg-white/5"
                />

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200">
                  <span className="truncate pr-2">
                    {currentDoc.name}
                  </span>
                  <span>
                    {lightboxIndex! + 1} / {docFiles.length}
                  </span>
                </div>
              </div>

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
};

export default DocumentsSection;
