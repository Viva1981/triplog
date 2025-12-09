"use client";

import { useState, useRef, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * UNIVERSAL FILE PREVIEW LOADER (PHOTO, IMAGE DOC, PDF → PNG)
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

        // -----------------------------------------
        // PHOTO OR IMAGE DOCUMENT → RAW IMAGE BLOB
        // -----------------------------------------
        if (file.mime_type?.startsWith("image/")) {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!res.ok) throw new Error("Image download failed");
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setSrc(url);
          }
          return;
        }

        // -----------------------------------------
        // PDF → PNG EXPORT (FIRST PAGE PREVIEW)
        // -----------------------------------------
        if (file.mime_type === "application/pdf") {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (!res.ok) throw new Error("PDF export failed");

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = url;
            setSrc(url);
          }
          return;
        }

        // -----------------------------------------
        // OTHER DOCUMENT TYPES (fallback)
        // -----------------------------------------
        setSrc(file.thumbnail_link || file.preview_link || null);
      } catch (e) {
        console.error("Preview load error:", e);
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

// ---------------------------------------------------------

interface FileCardProps {
  file: TripFile;
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  onPreviewClick?: () => void;
  onOpen?: () => void;
}

export default function FileCard({
  file,
  canManage,
  onRename,
  onDelete,
  onPreviewClick,
  onOpen,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { src, loading } = useDriveFilePreview(file);

  const isPhoto = file.type === "photo";
  const isImageFile =
    file.mime_type?.startsWith("image/") || file.type === "photo";
  const isPdf = file.mime_type === "application/pdf";

  const menuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClose(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("touchstart", handleClose);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("touchstart", handleClose);
    };
  }, []);

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* PREVIEW BLOCK */}
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl 
        h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Betöltés...
          </div>
        ) : src ? (
          <img
            src={src}
            alt={file.name}
            className={`h-full w-full ${
              isImageFile || isPdf
                ? "object-cover"
                : "object-contain p-6 bg-slate-50"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            {getFileIcon(file)}
          </div>
        )}
      </button>

      {/* MENU */}
      {canManage && (
        <div ref={menuRef} className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={menuToggle}
            className="rounded-full bg-white/90 p-1 shadow-sm"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-30">
              {onOpen && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100"
                >
                  Megnyitás Drive-ban
                </button>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100"
              >
                Átnevezés
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                Törlés
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

