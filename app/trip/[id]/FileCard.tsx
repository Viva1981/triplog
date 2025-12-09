"use client";

import { useState, useRef, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * Képfeltöltés Google Drive-ból, BLOB → object URL.
 * Csak kliens oldalon fut, csak fotókhoz használjuk.
 */
function useDriveImageBlob(file: TripFile | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!file) {
        setSrc(null);
        return;
      }

      // Ha nincs drive_file_id, visszaesünk a tárolt linkekre
      if (!file.drive_file_id) {
        setSrc(file.thumbnail_link || file.preview_link || null);
        return;
      }

      setLoading(true);

      try {
        // Supabase session → Google token
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) {
          // Nincs Google token → fallback a régi linkekre
          setSrc(file.thumbnail_link || file.preview_link || null);
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
          console.error("DRIVE BLOB FETCH ERROR:", res.status);
          setSrc(file.thumbnail_link || file.preview_link || null);
          return;
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        // Régi URL takarítása
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        urlRef.current = objectUrl;
        setSrc(objectUrl);
      } catch (err) {
        console.error("DRIVE BLOB FETCH UNEXPECTED ERROR:", err);
        setSrc(file.thumbnail_link || file.preview_link || null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

interface FileCardProps {
  file: TripFile;
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  onPreviewClick?: () => void;
  onOpen?: () => void; // dokumentum esetén
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

  // Fotóknál használjuk a Drive blob loadert
  const { src: photoSrc, loading: photoLoading } = useDriveImageBlob(
    isPhoto ? file : null
  );

  const menuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleScroll() {
      setMenuOpen(false);
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuOpen]);

  // ---------------------- PHOTO CARD ----------------------

  if (isPhoto) {
    return (
      <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        {/* FŐ KATTINTÁS → preview (lightbox) */}
        <button
          type="button"
          onClick={onPreviewClick}
          className="block w-full overflow-hidden rounded-2xl 
            h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
        >
          {photoLoading && !photoSrc ? (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              Betöltés...
            </div>
          ) : photoSrc ? (
            <img
              src={photoSrc}
              alt={file.name}
              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              Nincs előnézet
            </div>
          )}
        </button>

        {/* MENÜ */}
        {canManage && (
          <div ref={menuRef} className="absolute right-2 top-2 z-20">
            <button
              type="button"
              onClick={menuToggle}
              className="rounded-full bg-white/90 p-1 shadow-sm hover:bg-slate-100"
            >
              <span className="text-xl leading-none">⋮</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-30">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRename();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100"
                >
                  Átnevezés
                </button>

                <button
                  type="button"
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

  // ---------------------- DOCUMENT CARD ----------------------
  // Itt EGYELŐRE marad a régi logika: thumbnail_link / preview_link vagy ikon

  const docThumbSrc = file.thumbnail_link || file.preview_link || null;

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl 
          h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {docThumbSrc ? (
          <img
            src={docThumbSrc}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            {getFileIcon(file)}
          </div>
        )}
      </button>

      {canManage && (
        <div ref={menuRef} className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={menuToggle}
            className="rounded-full bg-white/90 p-1 shadow-sm hover:bg-slate-100"
          >
            <span className="text-xl leading-none">⋮</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-30">
              {onOpen && (
                <button
                  type="button"
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
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100"
              >
                Átnevezés
              </button>

              <button
                type="button"
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
