"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getFileIcon } from "@/lib/trip/fileIcons";

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

/**
 * Google provider_token stabil megszerzése:
 * - getSession()
 * - ha van session, de nincs provider_token: refreshSession()
 * - onAuthStateChange figyelés
 */
function useGoogleProviderToken() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      setToken(data.session?.provider_token ?? null);
      setChecked(true);

      // Hard reload / inkognitó eset: van session, de provider_token később jön
      if (data.session && !data.session.provider_token) {
        try {
          await supabase.auth.refreshSession();
          const { data: after } = await supabase.auth.getSession();
          if (!alive) return;
          setToken(after.session?.provider_token ?? null);
        } catch {
          // maradhat null
        }
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.provider_token ?? null);
      setChecked(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { token, checked, tokenReady: checked && !!token };
}

/**
 * Lightbox preview blob:
 * - image/* -> alt=media
 * - application/pdf -> export?mimeType=image/png (első oldal)
 */
function useLightboxPreviewBlob(file: TripFile | null) {
  const { token, checked, tokenReady } = useGoogleProviderToken();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // várjuk meg, hogy kiderüljön: van-e token
      if (!checked) return;

      if (!file) {
        setSrc(null);
        return;
      }

      if (!file.drive_file_id) {
        setSrc(null);
        return;
      }

      if (!token) {
        setSrc(null);
        return;
      }

      const isImage = !!file.mime_type?.startsWith("image/");
      const isPdf = file.mime_type === "application/pdf";

      if (!isImage && !isPdf) {
        setSrc(null);
        return;
      }

      setLoading(true);

      try {
        const url = isPdf
          ? `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`
          : `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setSrc(null);
          return;
        }

        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objUrl);
          return;
        }

        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objUrl;
        setSrc(objUrl);
      } catch (err) {
        console.error("LIGHTBOX BLOB ERROR:", err);
        setSrc(null);
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
  }, [file?.id, file?.drive_file_id, file?.mime_type, token, checked]);

  return { src, loading, tokenReady };
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

  const current = lightboxIndex !== null ? docFiles[lightboxIndex] : null;

  // ✅ tokenes blob + PDF export preview a lightboxnak
  const { src: lightboxSrc, loading: lightboxLoading, tokenReady } =
    useLightboxPreviewBlob(current);

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
              Dokumentumokat tölthetsz fel közvetlenül az eszközödről — a TripLog
              automatikusan elmenti az utazás Google Drive mappájába.
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
                    } else if (file.preview_link) {
                      window.open(file.preview_link, "_blank");
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

      {/* LIGHTBOX */}
      {current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute inset-0"
            aria-label="Bezárás"
          />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] rounded-2xl bg-black/80 p-3 md:p-4">
            <div className="relative flex items-center justify-between">
              {/* balra nyíl (desktop) */}
              <button
                type="button"
                onClick={showPrev}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black md:flex"
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
                {lightboxLoading ? (
                  <div className="text-xs text-white">Betöltés…</div>
                ) : lightboxSrc ? (
                  <motion.img
                    key={current.id}
                    src={lightboxSrc}
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
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-white/80">
                    <div className="text-4xl">{getFileIcon(current)}</div>
                    {!tokenReady ? (
                      <div className="text-center">
                        <div className="text-xs">Betöltés…</div>
                        <div className="text-[10px] text-white/60">
                          (Google token)
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">Nincs előnézet</div>
                    )}

                    {current.drive_file_id && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `https://drive.google.com/file/d/${current.drive_file_id}/view`,
                            "_blank"
                          )
                        }
                        className="rounded-full bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/20"
                      >
                        Megnyitás Drive-ban
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* jobbra nyíl (desktop) */}
              <button
                type="button"
                onClick={showNext}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black md:flex"
              >
                ▶
              </button>
            </div>

            {/* HUD (zoom alatt eltűnik) */}
            {!isZoomed && (
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-between px-4 text-[11px] text-slate-200">
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
