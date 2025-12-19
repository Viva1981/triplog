"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook: Dokumentum nagy felbontású előnézete (Privát fájlokhoz).
 * - Képek esetén: letölti a fájlt (alt=media).
 * - PDF esetén: a Drive-al generáltat egy PNG képet az első oldalról (/export).
 */
function useDocumentLightboxPreview(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!file?.drive_file_id) {
        setSrc(null);
        return;
      }
      
      const isImage = file.mime_type?.startsWith("image/");
      const isPdf = file.mime_type === "application/pdf";

      // Csak kép vagy PDF esetén tudunk "képes" előnézetet adni
      if (!isImage && !isPdf) {
        setSrc(null);
        return;
      }

      setSrc(null);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) return;

        // Ugyanaz a logika, mint a FileCard-ban:
        // PDF -> export képként
        // Kép -> letöltés
        const url = isPdf
          ? `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`
          : `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Lightbox preview error");

        const blob = await res.blob();
        if (!active) return;

        const objUrl = URL.createObjectURL(blob);
        
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objUrl;
        
        setSrc(objUrl);

      } catch (err) {
        console.error("Dokumentum lightbox hiba:", err);
      }
    }

    load();

    return () => {
      active = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [file?.drive_file_id, file?.mime_type]);

  return src;
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

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFileToDriveAndSave("document", f);
    e.target.value = "";
  };

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

  const current = lightboxIndex !== null ? docFiles[lightboxIndex] : null;
  
  // Itt töltjük be a "képes" verziót (akár PDF, akár JPG)
  const lightboxSrc = useDocumentLightboxPreview(current);

  return (
    <>
      {/* GRID SECTION */}
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dokumentumok
            </h2>
            <p className="text-xs text-slate-500">
              PDF-ek és képek előnézettel.
            </p>
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

        {/* Hibaüzenetek */}
        {(docError || filesError) && (
          <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {docError || filesError}
          </div>
        )}

        {docSuccess && (
          <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {docSuccess}
          </div>
        )}

        {/* Lista */}
        {loadingFiles ? (
          <div className="text-xs text-slate-400">Betöltés…</div>
        ) : docFiles.length === 0 ? (
          <div className="text-xs text-slate-400">Még nincs dokumentum.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {docFiles.map((file, index) => {
              const canManage =
                !!currentUserId && file.user_id === currentUserId;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onPreviewClick={() => openLightbox(index)}
                  onOpen={() => {
                    if (file.drive_file_id) {
                      window.open(
                        `https://drive.google.com/file/d/${file.drive_file_id}/view`,
                        "_blank"
                      );
                    }
                  }}
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

      {/* LIGHTBOX OVERLAY */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm px-3">
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute inset-0 cursor-default"
            aria-label="Bezárás"
          />

          <div className="relative z-50 w-full max-w-5xl h-full flex flex-col justify-center pointer-events-none">
            <div className="relative flex items-center justify-between w-full h-full pointer-events-auto">
              
              <button
                type="button"
                onClick={showPrev}
                className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition mx-4 md:flex"
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
                {/* Ha sikerült képet csinálni belőle (PDF vagy JPG), akkor azt mutatjuk */}
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
                  // Ha még töltődik, vagy nem támogatott formátum
                  <div className="flex flex-col items-center justify-center gap-4 text-white animate-pulse">
                     <div className="text-sm">Előnézet betöltése...</div>
                     {current.mime_type === "application/pdf" && (
                         <div className="text-xs text-white/60">(PDF konvertálása)</div>
                     )}
                  </div>
                )}
              </motion.div>

              <button
                type="button"
                onClick={showNext}
                className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition mx-4 md:flex"
              >
                ▶
              </button>
            </div>

            {/* Infó sáv */}
            {!isZoomed && (
              <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 pointer-events-auto">
                 {/* PDF-nél egy extra gomb, ha a konverzió nem lenne elég jó */}
                 {current.mime_type === "application/pdf" && (
                    <a
                      href={`https://drive.google.com/file/d/${current.drive_file_id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white/20 px-4 py-1 text-[10px] text-white hover:bg-white/30 backdrop-blur-md mb-2"
                    >
                      Eredeti PDF megnyitása ↗
                    </a>
                 )}

                <div className="flex justify-between w-full px-6 text-xs text-white/80 pointer-events-none">
                    <span className="truncate pr-4">{current.name}</span>
                    <span>
                    {lightboxIndex! + 1} / {docFiles.length}
                    </span>
                </div>
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