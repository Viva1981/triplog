"use client";

import { useState } from "react";

import { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";

interface FileCardProps {
  file: TripFile;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onOpen?: (id: string) => void; // docs only
}

export default function FileCard({
  file,
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

  return (
    <div className="relative bg-white shadow-sm rounded-2xl border border-slate-200 p-3 flex flex-col gap-2 hover:shadow-md transition">
      {/* Thumbnail / Icon */}
      <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
        {isPhoto && file.thumbnail_link ? (
          <img
            src={file.thumbnail_link}
            alt={file.name}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="p-4 opacity-70">{getFileIcon(file)}</div>
        )}
      </div>

      {/* Filename */}
      {editing ? (
        <input
          className="border border-slate-300 rounded-xl px-2 py-1 text-sm w-full"
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
        <div className="text-sm font-medium truncate">{file.name}</div>
      )}

      {/* Kebab menu */}
      <div className="absolute top-3 right-3">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded-full hover:bg-slate-100"
        >
          <span className="text-xl leading-none">⋮</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 bg-white shadow-lg rounded-xl border border-slate-200 w-36 z-20">
            {/* Megnyitás – csak ha kapunk onOpen-t (pl. doksiknál) */}
            {onOpen && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpen(file.id);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
              >
                Megnyitás
              </button>
            )}

            {/* Átnevezés */}
            <button
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
            >
              Átnevezés
            </button>

            {/* Törlés */}
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(file.id);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Törlés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
