"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook: Univerzális előnézet (Kép és PDF).
 * - Ha Kép: letölti az eredetit.
 * - Ha PDF: lekéri a Drive-tól a thumbnail-t, és azt tölti le.
 */
function useUnifiedDrivePreview(file: TripFile) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      // 1. Detektálás
      const isImage = file.type === "photo" || file.mime_type?.startsWith("image/");
      const isPdf = file.mime_type === "application/pdf";

      // Ha se nem kép, se nem PDF, vagy nincs ID -> kilépünk
      if ((!isImage && !isPdf) || !file.drive_file_id) {
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

        let downloadUrl = "";
        let directDownload = false;

        if (isImage) {
          // KÉP: Eredeti tartalom
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`;
          directDownload = true;
        } else {
          // PDF: Thumbnail link lekérése
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?fields=thumbnailLink`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!metaRes.ok) throw new Error("Meta fetch failed");
          const metaJson = await metaRes.json();

          if (metaJson.thumbnailLink) {
            // Feljavítjuk a minőséget a Gridhez (=s500)
            downloadUrl = metaJson.thumbnailLink.replace(/=s\d+/, "=s500");
            directDownload = true;
          } else {
            // Nincs thumbnail -> marad az ikon
            directDownload = false;
          }
        }

        if (directDownload) {
          // A tartalom (kép vagy thumbnail) letöltése Blob-ként
          const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) throw new Error("Content fetch failed");

          const blob = await res.blob();
          if (!active) return;

          const objUrl = URL.createObjectURL(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = objUrl;
          setSrc(objUrl);
        }
      } catch (err) {
        console.error("Preview error:", file.name, err);
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

  // Az "okos" hook használata
  const { src: previewSrc, loading } = useUnifiedDrivePreview(file);

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
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px] text-left"
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
          </div>
        ) : hasPreview ? (
          <img
            src={previewSrc!}
            alt={file.name}
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
          />
        ) : (
          /* Fallback: Ikon + Név (ha pl. Word doksi, vagy nincs thumbnail) */
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
            <div className="mb-3 scale-125 transform transition-transform group-hover:scale-110">
              {getFileIcon(file)}
            </div>
            <div className="w-full truncate text-xs font-medium text-slate-700 px-2">
              {file.name}
            </div>
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