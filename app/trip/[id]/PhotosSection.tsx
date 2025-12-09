"use client";

import React, { useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";

// ----------------------
// LIGHTBOX KÉP FORRÁSA
// ----------------------
// 👉 A lightbox mindig a Drive preview_link-et használja.
// 👉 Ez volt a régi, stabil működés.
// 👉 Soha nem thumbnail_link, mert az 404-et és CORB hibát dob.
function getPhotoLightboxSrc(file: TripFile): string {
  return file.preview_link || file.thumbnail_link || "";
}

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

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("photo", file);
    event.target.value = "";
  };

  const openLightbox = (index: number) => {
    if (photoFiles.length === 0) return;
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
    if (lightboxIndex === null || photoFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === 0 ? photoFiles.length - 1 : (prev as number) - 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const showNext = () => {
    if (lightboxIndex === null || photoFiles.length === 0) return;
    setLightboxIndex((prev) =>
      prev === photoFiles.length - 1 ? 0 : (prev as number) + 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  // Swipe
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (isZoomed) return;

    const threshold = 80;
    if (info.offset.x > threshold) showPrev();
    else if (info.offset.x < -threshold) showNext();
  };

  // Double tap → zoom
  const handleImageTap = () => {
    const now = Date.now();

    if (lastTap && now - lastTap < 300) {
      const nextZoom = !isZoomed;
      setIsZoomed(nextZoom);
      if (!nextZoom) resetPosition();
    }

    setLastTap(now);
  };

  const current =
    lightboxIndex !== null ? photoFiles[lightboxIndex] : null;

  return (
    <>
      {/* GRID */}
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fotók
            </h2>
            <p className="text-xs text-slate-500">
              A képek a Drive-ba kerülnek. A TripLog automatikusan beolvassa őket.
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

        {loadingFiles ? (
          <div className="text-xs text-slate-500">Betöltés...</div>
        ) : photoFiles.length === 0 ? (
          <div className="text-xs text-slate-400">Nincs fotó.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {photoFiles.map((file, index) => {
              const canManage =
                !!currentUserId && file.user_id === currentUserId;

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
        )}
      </section>

      {/* LIGHTBOX */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
          {/* bezárás */}
          <button onClick={closeLightbox} className="absolute inset-0" />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-black/80 p-3 md:p-4">
            <div className="relative flex items-center justify-between">
              {/* balra */}
              <button
                onClick={showPrev}
                className="hidden h-8 w-8 md:flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ◀
              </button>

              {/* kép */}
              <motion.div
                className="relative flex flex-1 items-center justify-center"
                drag={isZoomed ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                <motion.img
                  key={current.id}
                  src={getPhotoLightboxSrc(current)}
                  alt={current.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-auto rounded-xl object-contain"
                  style={{ scale: isZoomed ? 2 : 1 }}
                  animate={controls}
                  drag={isZoomed}
                  dragConstraints={
                    isZoomed
                      ? { left: -150, right: 150, top: -150, bottom: 150 }
                      : undefined
                  }
                  dragMomentum={false}
                  onClick={handleImageTap}
                />
              </motion.div>

              {/* jobbra */}
              <button
                onClick={showNext}
                className="hidden h-8 w-8 md:flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ▶
              </button>
            </div>

            {/* HUD */}
            {!isZoomed && (
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-between px-4 text-[11px] text-slate-200">
                <span>{current.name}</span>
                <span>
                  {lightboxIndex! + 1}/{photoFiles.length}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PhotosSection;
