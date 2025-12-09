"use client";

import { useState, useRef, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";

/**
 * Proxy thumbnail URL — mindig működik, minden böngészőben,
 * mert nem közvetlenül a Drive-hoz megy.
 */
function getProxyThumbnail(file: TripFile): string {
  if (file.drive_file_id) {
    return `/api/drive-image?fileId=${file.drive_file_id}`;
  }

  // régi adat fallback
  return file.thumbnail_link || file.preview_link || "";
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
  const thumbSrc = getProxyThumbnail(file);

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
        {/* MAIN CLICK → preview */}
        <button
          type="button"
          onClick={onPreviewClick}
          className="block w-full overflow-hidden rounded-2xl 
            h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
        >
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={file.name}
              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              Nincs előnézet
            </div>
          )}
        </button>

        {/* MENU */}
        {canManage && (
          <div ref={menuRef} className="absolute right-2 top-2 z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
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

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl 
          h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
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
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
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
