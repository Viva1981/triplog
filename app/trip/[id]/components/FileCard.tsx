"use client";

import { useState } from "react";
import { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";

interface FileCardProps {
  file: TripFile;
  /** Csak az kezelheti (átnevezés, törlés), aki feltöltötte. Ha nincs megadva → mindenki. */
  canManage?: boolean;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  /** Dokumentumoknál opcionális "Megnyitás" akció (Drive-ban). */
  onOpen?: (id: string) => void;
}

export default function FileCard({
  file,
  canManage = true,
  onRename,
  onDelete,
  onOpen,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(file.name);

  const isPhoto = file.type === "photo";

  const commitRename = () => {
    if (newName.trim() && newName !== file.name) {
      onRename(file.id, newName.trim());
    }
    setEditing(false);
  };

  const hasMenuItems = !!onOpen || canManage;

  return (
    <div className="relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition">
      {/* Thumbnail / Icon */}
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        {isPhoto && file.thumbnail_link ? (
          <img
            src={file.thumbnail_link}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="p-4 opacity-70">{getFileIcon(file)}</div>
        )}
      </div>

      {/* Filename */}
      {editing ? (
        <input
          className="w-full rounded-xl border border-slate-300 px-2 py-1 text-sm"
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditing(false);
              setNewName(file.name);
            }
          }}
        />
      ) : (
        <div className="truncate text-sm font-medium text-slate-900">
          {file.name}
        </div>
      )}

      {/* Kebab menu */}
      {hasMenuItems && (
        <div className="absolute right-3 top-3">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            <span className="text-xl leading-none">⋮</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 rounded-xl border border-slate-200 bg-white text-sm shadow-lg z-20">
              {onOpen && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen(file.id);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100"
                >
                  Megnyitás
                </button>
              )}

              {canManage && (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(true);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100"
                  >
                    Átnevezés
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(file.id);
                    }}
                    className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                  >
                    Törlés
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
