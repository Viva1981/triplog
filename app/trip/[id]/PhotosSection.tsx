"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook: Nagy felbontású kép betöltése Lightboxhoz (Privát Drive fájl)
 */
function useLightboxImage(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!file?.drive_file_id) {
        setSrc(null);
        return;
      }
      
      // Reset
      setSrc(null);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) return;

        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) throw new Error("Lightbox load error");

        const blob = await res.blob();
        if (!active) return;

        const objUrl = URL.createObjectURL(blob);
        
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objUrl;
        
        setSrc(objUrl);

      } catch (err) {
        console.error("Lightbox hiba:", err);
      }
    }

    load();

    return () => {
      active = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
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
  // Itt hívjuk a privát betöltőt
  const lightboxSrc = useLightboxImage(current);

  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fotók
            </h2>
            <p className="text-xs text-slate-500">
              A képek privát Drive mappába kerülnek.
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm px-3">
          <button onClick={closeLightbox} className="absolute inset-0 cursor-default" />

          <div className="relative z-50 w-full max-w-5xl h-full flex flex-col justify-center pointer-events-none">
            <div className="relative flex items-center justify-between w-full h-full pointer-events-auto">
              
              <button
                onClick={showPrev}
                className="hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition mx-4"
              >
                ◀
              </button>

              <motion.div
                className="relative flex flex-1 items-center justify-center h-full overflow-hidden"
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
                    className="max-h-[85vh] max-w-full object-contain rounded-sm shadow-2xl"
                    style={{ scale: isZoomed ? 2 : 1, cursor: isZoomed ? "zoom-out" : "zoom-in" }}
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
                  <div className="text-white text-sm animate-pulse">
                    Kép betöltése privát mappából...
                  </div>
                )}
              </motion.div>

              <button
                onClick={showNext}
                className="hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition mx-4"
              >
                ▶
              </button>
            </div>

            {!isZoomed && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 text-xs text-white/80 pointer-events-none">
                <span className="truncate pr-4">{current.name}</span>
                <span className="whitespace-nowrap">
                  {lightboxIndex! + 1} / {photoFiles.length}
                </span>
              </div>
            )}
            
            <button 
                onClick={closeLightbox}
                className="absolute top-4 right-4 z-50 p-2 text-white/70 hover:text-white pointer-events-auto bg-black/20 rounded-full md:bg-transparent"
            >
                ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}