"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TripFile } from "../../../lib/trip/types";
import FileCard from "./FileCard";

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
  ) => Promise<void>;
  handleRenameFile: (file: TripFile) => Promise<void>;
  handleDeleteFile: (
    fileId: string,
    type: "photo" | "document",
    driveFileId?: string | null
  ) => Promise<void>;
  currentUserId: string | null;
  hasMultipleParticipants: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  hasMultipleParticipants,
}) => {
  // --- Lightbox state ---
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDistanceRef = useRef<number | null>(null);
  const baseZoomRef = useRef(1);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  const sortedPhotos = useMemo(
    () =>
      [...photoFiles].sort((a, b) =>
        (a.created_at || "").localeCompare(b.created_at || "")
      ),
    [photoFiles]
  );

  const hasFiles = sortedPhotos.length > 0;

  const resetTransform = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    pointersRef.current.clear();
    lastDistanceRef.current = null;
    baseZoomRef.current = 1;
    lastPanRef.current = null;
  }, []);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    resetTransform();
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    resetTransform();
  };

  const showNext = () => {
    if (lightboxIndex === null || sortedPhotos.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % sortedPhotos.length);
    resetTransform();
  };

  const showPrev = () => {
    if (lightboxIndex === null || sortedPhotos.length === 0) return;
    setLightboxIndex(
      (lightboxIndex - 1 + sortedPhotos.length) % sortedPhotos.length
    );
    resetTransform();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeLightbox();
    }
  };

  // --- Pinch + pan logika ---
  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    const map = pointersRef.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (map.size === 2) {
      const pts = Array.from(map.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      lastDistanceRef.current = Math.hypot(dx, dy);
      baseZoomRef.current = zoom;
      lastPanRef.current = null;
    } else if (map.size === 1) {
      lastPanRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const map = pointersRef.current;
    if (!map.has(e.pointerId)) return;

    map.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Két ujjas pinch
    if (map.size === 2 && lastDistanceRef.current) {
      const pts = Array.from(map.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const distance = Math.hypot(dx, dy);

      const scaleFactor = distance / lastDistanceRef.current;
      const nextZoom = clamp(baseZoomRef.current * scaleFactor, 1, 4);
      setZoom(nextZoom);
    }
    // Egy ujjas pan (ha nagyítva van)
    else if (map.size === 1 && lastPanRef.current && zoom > 1) {
      const offset = lastPanRef.current;
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    const map = pointersRef.current;
    if (map.has(e.pointerId)) {
      map.delete(e.pointerId);
    }
    if (map.size < 2) {
      lastDistanceRef.current = null;
      baseZoomRef.current = zoom;
    }
    if (map.size === 0) {
      lastPanRef.current = null;
    }
  };

  const currentPhoto =
    lightboxIndex !== null && sortedPhotos[lightboxIndex]
      ? sortedPhotos[lightboxIndex]
      : null;

  const canManage = (file: TripFile) => currentUserId && file.user_id === currentUserId;

  return (
    <div className="bg-white rounded-3xl shadow-sm p-4 md:p-5">
      {/* Header + upload gomb */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fotók</h2>
          <p className="text-xs text-slate-500">
            Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
            automatikusan elmenti őket az utazás Google Drive mappájába.
          </p>
        </div>

        <div>
          <label className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium shadow hover:bg-emerald-600 cursor-pointer transition">
            {submittingPhoto ? "Feltöltés..." : "Feltöltés"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={submittingPhoto}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await uploadFileToDriveAndSave("photo", file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* státuszok */}
      {photoError && (
        <p className="text-xs text-red-500 mb-2">
          Hiba a feltöltésnél: {photoError}
        </p>
      )}
      {photoSuccess && (
        <p className="text-xs text-emerald-600 mb-2">{photoSuccess}</p>
      )}

      {filesError && (
        <p className="text-xs text-red-500 mb-2">{filesError}</p>
      )}

      {loadingFiles && !hasFiles && (
        <p className="text-sm text-slate-500">Fotók betöltése...</p>
      )}

      {!loadingFiles && !hasFiles && (
        <p className="text-sm text-slate-500">
          Még nincs egyetlen fotó sem ehhez az utazáshoz.
        </p>
      )}

      {/* rács */}
      {hasFiles && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sortedPhotos.map((file, idx) => (
            <FileCard
              key={file.id}
              file={file}
              type="photo"
              onRename={canManage(file) ? () => handleRenameFile(file) : undefined}
              onDelete={
                canManage(file)
                  ? () => handleDeleteFile(file.id, "photo", file.drive_file_id)
                  : undefined
              }
              onPreviewClick={() => openLightbox(idx)}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* multi-user infó */}
      {hasMultipleParticipants && (
        <p className="mt-3 text-[11px] text-slate-500 leading-snug">
          Csak az általad feltöltött fotókat tudod átnevezni vagy törölni az
          alkalmazásból. A többiek által feltöltött képek kezelése a Google
          Drive jogosultságaitól függ – ilyen esetben kérd meg az illetőt, hogy
          ő módosítsa vagy törölje a fájlt.
        </p>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {currentPhoto && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
          >
            {/* Bezárás */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 rounded-full bg-white/10 text-white px-3 py-1 text-sm hover:bg-white/20 transition"
            >
              Bezárás
            </button>

            {/* Lapozó nyilak */}
            {sortedPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrev();
                  }}
                  className="absolute left-4 md:left-6 text-white text-2xl md:text-3xl bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNext();
                  }}
                  className="absolute right-4 md:right-6 text-white text-2xl md:text-3xl bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center"
                >
                  ▶
                </button>
              </>
            )}

            {/* Kép pinch-zoom + pan-nel */}
            <motion.img
              key={currentPhoto.id}
              src={
                currentPhoto.preview_link ||
                currentPhoto.thumbnail_link ||
                ""
              }
              alt={currentPhoto.name}
              className="max-w-[92vw] max-h-[92vh] object-contain touch-none select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerOut={handlePointerUp}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotosSection;
