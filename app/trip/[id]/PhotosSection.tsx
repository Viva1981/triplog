"use client";

import React, { useState } from "react";
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

export default function PhotosSection({
  photoFiles,
  loadingFiles,
  submittingPhoto,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
  currentUserId,
}: PhotosSectionProps) {
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
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) =>
      prev === 0 ? photoFiles.length - 1 : (prev as number) - 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const showNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) =>
      prev === photoFiles.length - 1 ? 0 : (prev as number) + 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (isZoomed) return;

    const threshold = 80;
    if (info.offset.x > threshold) showPrev();
    else if (info.offset.x < -threshold) showNext();
  };

  const handleImageTap = () => {
    const now = Date.now();

    if (lastTap && now - lastTap < 300) {
      const nextZoom = !isZoomed;
      setIsZoomed(nextZoom);
      if (!nextZoom) resetPosition();
    }

    setLastTap(now);
  };

  const current = lightboxIndex !== null ? photoFiles[lightboxIndex] : null;
  const lightboxSrc = current?.preview_link || current?.thumbnail_link || null;

  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Fotók</h2>
            <p className="text-xs text-slate-500">
              A képek az utazás Drive mappájába kerülnek.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#16ba53] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90">
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
                    handleDeleteFile(file.id, "photo", file.drive_file_id)
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* LIGHTBOX OVERLAY */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm px-3">
          <button
            onClick={closeLightbox}
            className="absolute inset-0 cursor-default"
          />

          <div className="pointer-events-none relative z-50 flex h-full w-full max-w-5xl flex-col justify-center">
            <div className="pointer-events-auto relative flex h-full w-full items-center justify-between">
              <button
                onClick={showPrev}
                className="mx-4 hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition backdrop-blur-md hover:bg-white/20 md:flex"
              >
                ◀
              </button>

              <motion.div
                className="relative flex h-full flex-1 items-center justify-center overflow-hidden"
                drag={isZoomed ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                {lightboxSrc ? (
                  <motion.img
                    key={current.id}
                    src={lightboxSrc}
                    alt={current.name}
                    referrerPolicy="no-referrer"
                    className="max-h-[85vh] max-w-full rounded-sm object-contain shadow-2xl"
                    style={{
                      scale: isZoomed ? 2 : 1,
                      cursor: isZoomed ? "zoom-out" : "zoom-in",
                    }}
                    animate={controls}
                    drag={isZoomed}
                    dragConstraints={
                      isZoomed
                        ? { left: -300, right: 300, top: -300, bottom: 300 }
                        : undefined
                    }
                    dragMomentum={false}
                    onClick={handleImageTap}
                  />
                ) : (
                  <div className="text-sm text-white">
                    Nincs elérhető előnézet
                  </div>
                )}
              </motion.div>

              <button
                onClick={showNext}
                className="mx-4 hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition backdrop-blur-md hover:bg-white/20 md:flex"
              >
                ▶
              </button>
            </div>

            {!isZoomed && (
              <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-between px-6 text-xs text-white/80">
                <span className="truncate pr-4">{current.name}</span>
                <span className="whitespace-nowrap">
                  {lightboxIndex! + 1} / {photoFiles.length}
                </span>
              </div>
            )}

            <button
              onClick={closeLightbox}
              className="pointer-events-auto absolute right-4 top-4 z-50 rounded-full bg-black/20 p-2 text-white/70 hover:text-white md:bg-transparent"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}