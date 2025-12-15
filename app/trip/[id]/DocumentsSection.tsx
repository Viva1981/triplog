"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";
import { supabase } from "@/lib/supabaseClient";
import { motion, PanInfo, useAnimation } from "framer-motion";

/* ------------------------------------------------------------------ */
/* SESSION READY HOOK */
/* ------------------------------------------------------------------ */
function useAuthReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (active && data.session?.provider_token) {
        setReady(true);
      }
    }

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.provider_token) {
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return ready;
}

/* ------------------------------------------------------------------ */
/* DRIVE PREVIEW (IMAGE + PDF → PNG) */
/* ------------------------------------------------------------------ */
function useDrivePreview(file: TripFile | null, enabled: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !file) return;

    let cancelled = false;

    async function load() {
      if (!file.drive_file_id) return;

      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;
        if (!token) return;

        let url: string;

        // IMAGE
        if (file.mime_type?.startsWith("image/")) {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
        }
        // PDF → PNG
        else if (file.mime_type === "application/pdf") {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
        } else {
          return;
        }

        if (!cancelled) {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setSrc(url);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [file?.id, enabled]);

  return { src, loading };
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */
type Props = {
  docFiles: TripFile[];
  loadingFiles: boolean;
  uploadFileToDriveAndSave: (
    type: "photo" | "document",
    file: File
  ) => void;
  handleRenameFile: (file: TripFile) => void;
  handleDeleteFile: (
    fileId: string,
    type: "photo" | "document",
    driveFileId?: string
  ) => void;
  currentUserId?: string | null;
};

export default function DocumentsSection({
  docFiles,
  loadingFiles,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
  currentUserId,
}: Props) {
  const authReady = useAuthReady();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const controls = useAnimation();

  const current =
    lightboxIndex !== null ? docFiles[lightboxIndex] : null;

  const { src: lightboxSrc, loading: lightboxLoading } =
    useDrivePreview(current, authReady);

  const close = () => setLightboxIndex(null);

  /* ------------------- UI ------------------- */

  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex justify-between">
          <h2 className="text-base font-semibold">Dokumentumok</h2>

          <label className="cursor-pointer rounded-full bg-emerald-500 px-4 py-2 text-xs text-white">
            <input
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFileToDriveAndSave("document", f);
                e.target.value = "";
              }}
            />
            Feltöltés
          </label>
        </div>

        {/* AUTH NOT READY */}
        {!authReady ? (
          <div className="text-xs text-slate-400">
            Hitelesítés betöltése…
          </div>
        ) : loadingFiles ? (
          <div className="text-xs text-slate-400">Betöltés…</div>
        ) : docFiles.length === 0 ? (
          <div className="text-xs text-slate-400">Nincs dokumentum.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {docFiles.map((file, index) => {
              const canManage =
                !!currentUserId && file.user_id === currentUserId;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onPreviewClick={() => setLightboxIndex(index)}
                  onOpen={() =>
                    window.open(
                      `https://drive.google.com/file/d/${file.drive_file_id}/view`,
                      "_blank"
                    )
                  }
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
      {authReady && current && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <button onClick={close} className="absolute inset-0" />

          <div className="relative z-50 max-w-3xl">
            {lightboxLoading ? (
              <div className="text-white text-xs">Betöltés…</div>
            ) : lightboxSrc ? (
              <motion.img
                src={lightboxSrc}
                className="max-h-[70vh] rounded-xl object-contain"
                animate={controls}
              />
            ) : (
              <div className="text-white">Nincs előnézet</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
