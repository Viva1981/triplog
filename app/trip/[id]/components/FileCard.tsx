"use client";

import { useState } from "react";
import { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";

interface FileCardProps {
  file: TripFile;
  /** Csak az kezelheti (átnevezés, törlés), aki feltöltötte. */
  canManage: boolean;
  onRename: () => void;
  onDelete: () => void;
  /** Dokumentumoknál opcionális "Megnyitás" akció (Drive-ban). */
  onOpen?: () => void;
}

export default function FileCard({
  file,
  canManage,
  onRename,
  onDelete,
  onOpen,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isPhoto = file.type === "photo";
  const thumbSrc = file.thumbnail_link || file.preview_link || undefined;

  const hasMenuItems = canManage || !!onOpen;

  return (
    <div className="relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition">
      {/* Thumbnail / Icon */}
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        {isPhoto && thumbSrc ? (
          <img
            src={thumbSrc}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : isPhoto ? (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
            Nincs előnézet
          </div>
        ) : (
          <div className="p-4 opacity-70">{getFileIcon(file)}</div>
        )}
      </div>

      {/* Név + docs megnyitás link */}
      <div className="flex flex-1 flex-col justify-between gap-1">
        <div
          className="truncate text-sm font-medium text-slate-900"
          title={file.name}
        >
          {file.name}
        </div>

        {/* Dokumentumoknál külön "Megnyitás Drive-ban" link – mindenkinek */}
        {!isPhoto && file.preview_link && (
          <a
            href={file.preview_link}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 text-[10px] text-emerald-600 underline"
          >
            Megnyitás Drive-ban
          </a>
        )}
      </div>

      {/* Kebab menü – csak ha van mit mutatni, és csak a feltöltőnek (canManage) vagy ha onOpen menübe akarjuk tenni */}
      {hasMenuItems && canManage && (
        <div className="absolute right-3 top-3">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            <span className="text-xl leading-none">⋮</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-20">
              {onOpen && (
                <button
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
