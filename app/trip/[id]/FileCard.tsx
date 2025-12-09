"use client";

import { useState, useRef, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * BLOB LOADER – csak képfájlokhoz (photo + image/* document)
 */
function useDriveImageBlob(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!file) return;

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

        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) {
          console.error("BLOB FETCH ERROR:", res.status);
          setSrc(file.thumbnail_link || file.preview_link || null);
          return;
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = objectUrl;
          setSrc(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        console.error("BLOB FAIL:", err);
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
  }, [file?.drive_file_id, file?.thumbnail_link, file?.preview_link]);

  return { src, loading };
}

/**
 * PDF thumbnail loader
 */
function usePdfThumbnail(file: TripFile | null) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!file) return;
      if (file.mime_type !== "application/pdf") return;
      if (!file.drive_file_id) return;

      const { data } = await supabase.auth.getSession();
      const token = data.session?.provider_token;
      if (!token) return;

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?fields=thumbnailLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!metaRes.ok) return;
      const meta = await metaRes.json();

      if (meta.thumbnailLink) {
        const hd = meta.thumbnailLink.replace("=s220", "=s800");
        setThumb(hd);
      }
    }

    load();
  }, [file?.drive_file_id, file?.mime_type]);

  return thumb;
}

// --------------------------------------------------------

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

  const isPhoto = file.type === "photo";
  const isImageDoc =
    file.type === "document" && file.mime_type?.startsWith("image/");
  const isPdf = file.mime_type === "application/pdf";

  // BLOB csak képekhez
  const { src: blobSrc, loading: blobLoading } = useDriveImageBlob(
    isPhoto || isImageDoc ? file : null
  );

  // PDF előnézet Drive-ból
  const pdfThumb = usePdfThumbnail(isPdf ? file : null);

  const menuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    function close(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  // --------------------------------------------------------
  // PHOTO CARD
  // --------------------------------------------------------
  if (isPhoto) {
    return (
      <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
        <button
          type="button"
          onClick={onPreviewClick}
          className="block w-full overflow-hidden rounded-2xl h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
        >
          {blobLoading && !blobSrc ? (
            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
              Betöltés…
            </div>
          ) : blobSrc ? (
            <img
              src={blobSrc}
              alt={file.name}
              className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
              Nincs előnézet
            </div>
          )}
        </button>

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
              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-md text-sm">
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

  // --------------------------------------------------------
  // DOCUMENT CARD
  // --------------------------------------------------------

  // GRID ELŐNÉZET LOGIKA
  let previewSrc: string | null = null;

  if (isImageDoc) {
    previewSrc = blobSrc || file.thumbnail_link || file.preview_link || null;
  } else if (isPdf) {
    previewSrc = pdfThumb || file.thumbnail_link || null;
  } else {
    previewSrc = file.thumbnail_link || file.preview_link || null;
  }

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            {getFileIcon(file)}
          </div>
        )}
      </button>

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
            <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-md text-sm">
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

