"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook: Google token beszerzése és kép letöltése Blob-ként.
 * Ez a kulcs a privát fájlok megjelenítéséhez.
 */
function usePrivateDriveImage(file: TripFile) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // URL ref, hogy ne folyjon a memória (memory leak prevention)
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      // Csak akkor foglalkozunk vele, ha kép
      const isImage = file.type === "photo" || file.mime_type?.startsWith("image/");
      if (!isImage || !file.drive_file_id) {
        return;
      }

      setLoading(true);

      try {
        // 1. Token megszerzése
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) {
          console.warn("Nincs Google token, nem lehet betölteni a privát képet.");
          setLoading(false);
          return;
        }

        // 2. Kép letöltése a Drive API-n keresztül (alt=media)
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) throw new Error("Drive fetch error");

        // 3. Blob készítése
        const blob = await res.blob();
        if (!active) return;

        // 4. Object URL létrehozása
        const objUrl = URL.createObjectURL(blob);
        
        // Ha volt előző, takarítunk
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        
        urlRef.current = objUrl;
        setSrc(objUrl);

      } catch (err) {
        console.error("Kép betöltési hiba:", err);
        setSrc(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, [file.drive_file_id, file.type, file.mime_type]);

  return { src, loading };
}

interface FileCardProps {
  file: TripFile;
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  onOpen?: () => void; // dokumentum esetén
  onPreviewClick?: () => void; // lightbox
}

export default function FileCard({
  file,
  canManage,
  onRename,
  onDelete,
  onOpen,
  onPreviewClick,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Itt használjuk a privát betöltőt
  const { src: imageSrc, loading } = usePrivateDriveImage(file);

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

  // Ha documentum, vagy nincs kép, akkor ikon
  // Ha kép, akkor a letöltött Blob URL
  const showImage = !!imageSrc;
  
  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Betöltés...
          </div>
        ) : showImage ? (
          <img
            src={imageSrc!}
            alt={file.name}
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
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
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((p) => !p);
            }}
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