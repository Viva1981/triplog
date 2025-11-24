"use client";

import React, { useState, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";

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

function getPhotoLightboxSrc(file: TripFile): string {
  if (file.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${file.drive_file_id}&sz=w1600`;
  }
  if (file.thumbnail_link) return file.thumbnail_link;
  return file.preview_link || "";
}

const PhotosSection: React.FC<PhotosSectionProps> = ({
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
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [lastTap, setLastTap] = useState<number | null>(null);

  const controls = useAnimation();

  const resetPosition = async () => {
    await controls.start({ x: 0, y: 0, transition: { duration: 0.15 } });
  };

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setIsZoomed(false);
    resetPosition();
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setIsZoomed(false);
    resetPosition();
  };

  const showPrev = async () => {
    setLightboxIndex((prev) =>
      prev === 0 ? photoFiles.length - 1 : (prev as number) - 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const showNext = async () => {
    setLightboxIndex((prev) =>
      prev === photoFiles.length - 1 ? 0 : (prev as number) + 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (isZoomed) return;

    const t = 80;
    if (info.offset.x > t) showPrev();
    else if (info.offset.x < -t) showNext();
  };

  const handleImageTap = () => {
    const now = Date.now();

    if (lastTap && now - lastTap < 300) {
      const newZoom = !isZoomed;
      setIsZoomed(newZoom);
      if (!newZoom) resetPosition();
    }

    setLastTap(now);
  };

  const current =
    lightboxIndex !== null ? photoFiles[lightboxIndex] : null;

  return (
    <>
      {/* --- PHOTO GRID SECTION --- */}
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Fotók</h2>
            <p className="text-xs text-slate-500">
              Képeket tölthetsz fel – automatikusan mentjük őket a Google Drive mappába.
            </p>
            {photoFiles.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                Összesen {photoFiles.length} fotó.
              </p>
            )}
          </div>

          <label className="cursor-pointer rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await uploadFileToDriveAndSave("photo", f);
                e.target.value = "";
              }}
            />
            Feltöltés
          </label>
        </div>

        {/* errors */}
        {photoError && (
          <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{photoError}</div>
        )}

        {photoSuccess && (
          <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{photoSuccess}</div>
        )}

        {loadingFiles ? (
          <p className="text-xs text-slate-500">Betöltés...</p>
        ) : (
          <>
            {filesError && (
              <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{filesError}</div>
            )}

            {photoFiles.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Nincs fotó.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {photoFiles.map((file, i) => {
                  const canManage =
                    !!currentUserId && currentUserId === file.user_id;

                  return (
                    <FileCard
                      key={file.id}
                      file={file}
                      canManage={canManage}
                      onPreviewClick={() => openLightbox(i)}
                      onRename={() => handleRenameFile(file)}
                      onDelete={() =>
                        handleDeleteFile(file.id, "photo", file.drive_file_id)
                      }
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* --- LIGHTBOX --- */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
          {/* háttér */}
          <button className="absolute inset-0" onClick={closeLightbox} />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-black/80 p-3 md:p-4">
            {/* Close desktop */}
            <button
              onClick={closeLightbox}
              className="absolute right-3 top-3 hidden rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black md:inline-flex"
            >
              Bezárás
            </button>

            <div className="relative flex items-center justify-between">
              {/* Left arrow desktop */}
              <button
                onClick={showPrev}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black md:flex"
              >
                ◀
              </button>

              {/* IMAGE AREA */}
              <motion.div
                className="flex-1 flex items-center justify-center relative"
                drag={isZoomed ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                <motion.img
                  key={current.id}
                  src={getPhotoLightboxSrc(current)}
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-auto rounded-xl object-contain"
                  style={{ scale: isZoomed ? 2 : 1 }}
                  animate={controls}
                  drag={isZoomed}
                  dragMomentum={false}
                  onClick={handleImageTap}
                />
              </motion.div>

              {/* Right arrow desktop */}
              <button
                onClick={showNext}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black md:flex"
              >
                ▶
              </button>
            </div>

            {/* HUD (always fixed) */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-between px-4 text-white text-[12px] pointer-events-none">
              <span className="truncate">{current.name}</span>
              <span>
                {lightboxIndex! + 1} / {photoFiles.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotosSection;
