"use client";

import { useState, useRef, useEffect } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";

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

  const isPhoto = file.type === "photo";

  // Stabil thumbnail előnyben: Drive file ID → stabil URL
  const stableThumb = file.drive_file_id
    ? `https://drive.google.com/thumbnail?id=${file.drive_file_id}&sz=w400`
    : undefined;

  const thumbSrc =
    stableThumb ||
    file.thumbnail_link ||
    (isPhoto ? file.preview_link || undefined : undefined);

  // ---------------- CLICK OUTSIDE TO CLOSE ----------------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpen]);

  // ---------------------------------------------------------
  // ---------------------- PHOTO CARD -----------------------
  // ---------------------------------------------------------

  if (isPhoto) {
    return (
      <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        {/* clickable image */}
        <button
          type="button"
          onClick={onPreviewClick}
          className="block h-40 w-full overflow-hidden rounded-2xl sm:h-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={file.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              Nincs előnézet
            </div>
          )}
        </button>

        {/* KEBAB MENU – unified with document card */}
        {canManage && (
          <div ref={menuRef} className="absolute right-2 top-2 z-20">
            {/* kebab button */}
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

            {/* menu panel */}
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-30">
                {onOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpen();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100"
                  >
                    Megnyitás
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

  // ---------------------------------------------------------
  // ------------------ DOCUMENT CARD ------------------------
  // ---------------------------------------------------------

  const hasThumb = !!thumbSrc;

  const docPreviewContent = hasThumb ? (
    <img
      src={thumbSrc}
      alt={file.name}
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-slate-500">
      {getFileIcon(file)}
    </div>
  );

  const docPreview = (
    <button
      type="button"
      onClick={onPreviewClick}
      className="relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      style={{ aspectRatio: "3 / 4" }}
    >
      {docPreviewContent}
    </button>
  );

  return (
    <div className="group relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      {docPreview}

      {/* meta */}
      <div className="mt-1 flex flex-col gap-1">
        <div className="truncate text-sm font-medium text-slate-900" title={file.name}>
          {file.name}
        </div>

        {file.preview_link && (
          <button
            type="button"
            onClick={() => {
              if (onOpen) onOpen();
              else window.open(file.preview_link!, "_blank", "noopener,noreferrer");
            }}
            className="self-start text-[11px] font-medium text-emerald-600 underline"
          >
            Megnyitás Drive-ban
          </button>
        )}
      </div>

      {/* kebab */}
      {canManage && (
        <div ref={menuRef} className="absolute right-3 top-3 z-20">
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
            <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-30">
              {onOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100"
                >
                  Megnyitás
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
