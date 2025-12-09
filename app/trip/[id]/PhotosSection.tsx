"use client";

import React, { useState, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

/**
 * Blob-alapú image loader lightboxhoz
 */
function useDriveBlobImage(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const urlRef = React.useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!file?.drive_file_id) {
        setSrc(file?.preview_link || file?.thumbnail_link || null);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) {
          setSrc(file.preview_link || file.thumbnail_link || null);
          return;
        }

        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          console.error("LIGHTBOX BLOB ERROR", res.status);
          setSrc(file.preview_link || file.thumbnail_link || null);
          return;
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        if (urlRef.current) URL.revokeObjectURL(urlRef.current);

        urlRef.current = objectUrl;
        setSrc(objectUrl);
      } catch (err) {
        console.error("LIGHTBOX BLOB UNEXPECTED ERROR", err);
        setSrc(file?.preview_link || file?.thumbnail_link || null);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [file?.drive_file_id]);

  return src;
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
  const lightboxSrc = useDriveBlobImage(current);

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
                    handleDeleteFile(file.id, "photo", file.drive_file_id)
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
          <button onClick={closeLightbox} className="absolute inset-0" />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-black/80 p-3 md:p-4">
            <div className="relative flex items-center justify-between">
              <button
                onClick={showPrev}
                className="hidden h-8 w-8 md:flex items-center 
                justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ◀
              </button>

              <motion.div
                className="relative flex flex-1 items-center justify-center"
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
                ) : (
                  <div className="text-white text-xs">Betöltés...</div>
                )}
              </motion.div>

              <button
                onClick={showNext}
                className="hidden h-8 w-8 md:flex items-center 
                justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ▶
              </button>
            </div>

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
}
