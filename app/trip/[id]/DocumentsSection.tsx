"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

/**
 * UNIVERSAL DRIVE PREVIEW LOADER (PHOTO / IMAGE DOC / PDF → PNG)
 * Same logic as FileCard → this feeds the LIGHTBOX.
 */
function useDriveFilePreview(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!file) return;

      // fallback if missing ID
      if (!file.drive_file_id) {
        setSrc(file.thumbnail_link || file.preview_link || null);
        return;
      }

      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) {
          setSrc(file.thumbnail_link || file.preview_link || null);
          return;
        }

        // ---------------------------
        // IMAGE / PHOTO
        // ---------------------------
        if (file.mime_type?.startsWith("image/")) {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!res.ok) throw new Error("Image load failed.");

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setSrc(url);
          }
          return;
        }

        // ---------------------------
        // PDF → PNG EXPORT
        // ---------------------------
        if (file.mime_type === "application/pdf") {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!res.ok) throw new Error("PDF export failed.");

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setSrc(url);
          }
          return;
        }

        // ---------------------------
        // FALLBACK: other docs
        // ---------------------------
        setSrc(file.thumbnail_link || file.preview_link || null);
      } catch (err) {
        console.error("Lightbox preview error:", err);
        setSrc(file.thumbnail_link || file.preview_link || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [file?.drive_file_id, file?.mime_type]);

  return { src, loading };
}


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


export default function DocumentsSection({
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
}: DocumentsSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [lastTap, setLastTap] = useState<number | null>(null);

  const controls = useAnimation();

  const current = lightboxIndex !== null ? docFiles[lightboxIndex] : null;

  // 🟢 THIS LOADS PDF → PNG OR IMAGE → BLOB FOR LIGHTBOX
  const { src: lightboxSrc, loading: lightboxLoading } =
    useDriveFilePreview(current);

  const resetPosition = async () => {
    await controls.start({ x: 0, y: 0, transition: { duration: 0.15 } });
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
      prev === 0 ? docFiles.length - 1 : (prev as number) - 1
    );
    setIsZoomed(false);
    resetPosition();
  };

  const showNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((prev) =>
      prev === docFiles.length - 1 ? 0 : (prev as number) + 1
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
      const next = !isZoomed;
      setIsZoomed(next);
      if (!next) resetPosition();
    }
    setLastTap(now);
  };


  // ---------------------- UI RENDER -----------------------

  return (
    <>
      {/* GRID */}
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dokumentumok
            </h2>
            <p className="text-xs text-slate-500">
              A dokumentumok Drive-ban tárolódnak
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFileToDriveAndSave("document", f);
                e.target.value = "";
              }}
              disabled={submittingDoc}
            />
            {submittingDoc ? "Feltöltés..." : "Feltöltés"}
          </label>
        </div>

        {loadingFiles ? (
          <div className="text-xs text-slate-500">Betöltés...</div>
        ) : docFiles.length === 0 ? (
          <div className="text-xs text-slate-400">Nincs dokumentum.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {docFiles.map((file, index) => {
              const canManage = !!currentUserId && file.user_id === currentUserId;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onPreviewClick={() => openLightbox(index)}
                  onOpen={() =>
                    file.drive_file_id &&
                    window.open(
                      `https://drive.google.com/file/d/${file.drive_file_id}/view`,
                      "_blank"
                    )
                  }
                  onRename={() => handleRenameFile(file)}
                  onDelete={() =>
                    handleDeleteFile(file.id, "document", file.drive_file_id)
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
              {/* PREV */}
              <button
                onClick={showPrev}
                className="hidden h-8 w-8 md:flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                ◀
              </button>

              {/* IMAGE */}
              <motion.div
                className="relative flex flex-1 items-center justify-center"
                drag={isZoomed ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                {lightboxLoading ? (
                  <div className="text-white text-xs">Betöltés...</div>
                ) : lightboxSrc ? (
                  <motion.img
                    key={current.id}
                    src={lightboxSrc}
                    alt={current.name}
                    className="max-h-[70vh] w-auto rounded-xl object-contain bg-white/5"
                    style={{ scale: isZoomed ? 2 : 1 }}
                    animate={controls}
                    drag={isZoomed}
                    dragConstraints={
                      isZoomed
                        ? { left: -150, right: 150, top: -150, bottom: -150 }
                        : undefined
                    }
                    dragMomentum={false}
                    onClick={handleImageTap}
                  />
                ) : (
                  <div className="text-white">Nincs előnézet</div>
                )}
              </motion.div>

              {/* NEXT */}
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
                  {lightboxIndex! + 1}/{docFiles.length}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
