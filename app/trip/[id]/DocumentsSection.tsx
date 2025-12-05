"use client";

import React, { useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";

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

// Lightbox kép URL doksikhoz
function getDocumentLightboxSrc(file: TripFile): string {
  if (file.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${file.drive_file_id}&sz=w1600`;
  }
  if (file.thumbnail_link) return file.thumbnail_link;
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
  const [isZoomed, setIsZoomed] = useState(false);
  const [lastTap, setLastTap] = useState<number | null>(null);

  const controls = useAnimation();

  const resetPosition = async () => {
    await controls.start({ x: 0, y: 0, transition: { duration: 0.15 } });
  };

  const handleDocChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("document", file);
    event.target.value = "";
  };

  const openLightbox = (index: number) => {
    if (docFiles.length === 0) return;
    setLightboxIndex(index);
    setIsZoomed(false);
    resetPosition();
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setIsZoomed(false);
    resetPosition();
  };

  const showPrev = () => {
    if (lightboxIndex === null || docFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === 0 ? docFiles.length - 1 : (prev as number) - 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const showNext = () => {
    if (lightboxIndex === null || docFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === docFiles.length - 1 ? 0 : (prev as number) + 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  // Swipe csak zoomolatlan állapotban
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (isZoomed) return;

    const threshold = 80;
    if (info.offset.x > threshold) showPrev();
    else if (info.offset.x < -threshold) showNext();
  };

  // Dupla tap → zoom in/out
  const handleImageTap = () => {
    const now = Date.now();

    if (lastTap && now - lastTap < 300) {
      const nextZoom = !isZoomed;
      setIsZoomed(nextZoom);
      if (!nextZoom) {
        // zoom ki → pozíció reset
        resetPosition();
      }
    }

    setLastTap(now);
  };

  const current =
    lightboxIndex !== null ? docFiles[lightboxIndex] : null;

  return (
    <>
      {/* GRID SZEKCIÓ */}
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dokumentumok
            </h2>
            <p className="text-xs text-slate-500">
              Dokumentumokat tölthetsz fel közvetlenül az eszközödről – a TripLog automatikusan elmenti az utazás Google Drive mappájába.
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

        {loadingFiles ? (
          <div className="mt-4 text-xs text-slate-500">
            Dokumentumok betöltése...
          </div>
        ) : docFiles.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
            Még nincs dokumentum ehhez az utazáshoz.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
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
                  onPreviewClick={() => openLightbox(index)}
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
        )}
      </section>

      {/* LIGHTBOX */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
          {/* háttérre kattintva zár */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute inset-0"
          />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-black/80 p-3 md:p-4">
            {/* bezárás gomb desktopon */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 hidden rounded-full bg-black/60 px-2 py-1 text-xs text-slate-100 hover:bg-black md:inline-flex"
            >
              Bezárás
            </button>

            <div className="relative flex items-center justify-between">
              {/* balra nyíl (desktop) */}
              <button
                type="button"
                onClick={showPrev}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black md:flex"
              >
                ◀
              </button>

              {/* kép area – swipe / pan / zoom */}
              <motion.div
                className="relative flex flex-1 items-center justify-center"
                drag={isZoomed ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                <motion.img
                  key={current.id}
                  src={getDocumentLightboxSrc(current)}
                  alt={current.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-auto rounded-xl object-contain bg-white/5"
                  style={{ scale: isZoomed ? 2 : 1 }}
                  animate={controls}
                  drag={isZoomed}
                  dragConstraints={
                    isZoomed
                      ? { left: -120, right: 120, top: -120, bottom: 120 }
                      : undefined
                  }
                  dragMomentum={false}
                  onClick={handleImageTap}
                />
              </motion.div>

              {/* jobbra nyíl (desktop) */}
              <button
                type="button"
                onClick={showNext}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black md:flex"
              >
                ▶
              </button>
            </div>

            {/* HUD – csak ha nincs zoom */}
            {!isZoomed && (
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-between px-4 text-[11px] text-slate-200">
                <span className="truncate pr-2">{current.name}</span>
                <span>
                  {lightboxIndex! + 1} / {docFiles.length}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentsSection;
