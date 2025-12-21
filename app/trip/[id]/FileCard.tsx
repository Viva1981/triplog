"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

function useImageOnlyPreview(file: TripFile) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const isImage =
        file.type === "photo" || file.mime_type?.startsWith("image/");

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
  onOpen?: () => void;
  onPreviewClick?: () => void;
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

  // Stílus meghatározása: Képnél sötét áttetsző, Doksinál sima szürke
  const menuButtonStyle = hasPreview
    ? "bg-black/20 hover:bg-black/40 text-white backdrop-blur-md" // Fotó stílus
    : "bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-600"; // Doksi stílus

  return (
    <div className="group relative h-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <button
        type="button"
        onClick={onPreviewClick}
        className="flex h-40 w-full flex-col overflow-hidden rounded-2xl sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#16ba53]"></div>
          </div>
        ) : hasPreview ? (
          <img
            src={previewSrc!}
            alt={file.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-white p-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-md group-hover:bg-slate-100">
              <div className="scale-125 transform">{getFileIcon(file)}</div>
            </div>

            <div className="w-full px-2">
              <p className="line-clamp-3 text-xs font-semibold leading-relaxed text-slate-700 break-words">
                {file.name}
              </p>
              <p className="mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                {file.mime_type?.split("/").pop()?.toUpperCase() || "FÁJL"}
              </p>
            </div>
          </div>
        )}
      </button>

      {/* Diszkrét Kebab menü */}
      {canManage && (
        <div ref={menuRef} className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((p) => !p);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${menuButtonStyle}`}
          >
            <span className="mb-2 text-lg font-bold leading-none">...</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 origin-top-right animate-in fade-in zoom-in-95 duration-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl z-20">
              {onOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
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
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                Átnevezés
              </button>

              <div className="my-1 h-px bg-slate-100"></div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-4 py-2.5 text-left text-red-600 transition-colors hover:bg-red-50"
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