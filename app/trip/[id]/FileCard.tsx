"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook: Kizárólag a KÉPEK (jpg, png) előnézetét tölti be.
 * Minden más fájltípusnál (PDF, Doc) azonnal null-t ad vissza,
 * így az ikonnézet azonnal megjelenik.
 */
function useImageOnlyPreview(file: TripFile) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      // Csak akkor foglalkozunk vele, ha TÉNYLEG kép.
      // A PDF-eket itt szándékosan kihagyjuk, hogy ikonként jelenjenek meg.
      const isImage = file.type === "photo" || file.mime_type?.startsWith("image/");
      
      if (!isImage || !file.drive_file_id) {
        setSrc(null);
        return;
      }

      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.provider_token;

        if (!token) {
          setLoading(false);
          return;
        }

        // Kép letöltése (alt=media)
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!res.ok) throw new Error("Image fetch failed");

        const blob = await res.blob();
        if (!active) return;

        const objUrl = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objUrl;
        
        setSrc(objUrl);
      } catch (err) {
        console.error("Image preview error:", err);
        setSrc(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [file.drive_file_id, file.mime_type, file.type]);

  return { src, loading };
}

interface FileCardProps {
  file: TripFile;
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  onOpen?: () => void;        // Ez a "Megnyitás Drive-ban" menüpont
  onPreviewClick?: () => void; // Ez a főkártyára kattintás
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

  const { src: previewSrc, loading } = useImageOnlyPreview(file);

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

  const hasPreview = !!previewSrc;

  return (
    <div className="group relative h-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <button
        type="button"
        onClick={onPreviewClick}
        className="flex h-40 w-full flex-col overflow-hidden rounded-2xl sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {loading ? (
          // 1. Állapot: Töltés (csak képeknél fordulhat elő rövid ideig)
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
          </div>
        ) : hasPreview ? (
          // 2. Állapot: Kép előnézet (Full bleed)
          <img
            src={previewSrc!}
            alt={file.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // 3. Állapot: Dokumentum / PDF (Profi Ikon + Név)
          <div className="flex h-full w-full flex-col items-center justify-center bg-white p-4 text-center">
            {/* Ikon konténer: finom háttérrel kiemelve */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-slate-100">
              <div className="scale-125 transform">
                {getFileIcon(file)}
              </div>
            </div>
            
            {/* Fájlnév: jobban olvasható, több soros */}
            <div className="w-full px-2">
              <p className="line-clamp-3 text-xs font-semibold leading-relaxed text-slate-700 break-words">
                {file.name}
              </p>
              {/* Kiegészítő infó (típus) */}
              <p className="mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                {file.mime_type?.split("/").pop()?.toUpperCase() || "FÁJL"}
              </p>
            </div>
          </div>
        )}
      </button>

      {/* Kebab menü (Jobb felül) */}
      {canManage && (
        <div ref={menuRef} className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((p) => !p);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-100"
          >
            <span className="text-lg leading-none font-bold text-slate-600 mb-1">⋮</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white text-sm shadow-xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              {onOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <span>📂</span> Megnyitás Drive-ban
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span>✏️</span> Átnevezés
              </button>

              <div className="h-px bg-slate-100 my-1"></div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <span>🗑️</span> Törlés
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}