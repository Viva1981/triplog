"use client";

import { useEffect, useRef, useState } from "react";
import type { TripFile } from "@/lib/trip/types";
import { getFileIcon } from "@/lib/trip/fileIcons";
import { supabase } from "@/lib/supabaseClient";

/**
 * Google token figyelő (onAuthStateChange) + egyszeri refresh próbálkozás.
 * Ez kell ahhoz, hogy Ctrl+Shift+R / inkognitó / Edge esetén is legyen token.
 */
function useGoogleProviderToken() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      setToken(data.session?.provider_token ?? null);
      setChecked(true);

      // Gyakori: van session, de provider_token üres (hard reload / inkognitó)
      if (data.session && !data.session.provider_token) {
        try {
          await supabase.auth.refreshSession();
          const { data: after } = await supabase.auth.getSession();
          if (!alive) return;
          setToken(after.session?.provider_token ?? null);
        } catch {
          // maradhat null
        }
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.provider_token ?? null);
      setChecked(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { token, checked };
}

/**
 * Drive preview blob:
 * - image/* -> alt=media
 * - PDF -> export?mimeType=image/png (első oldal)
 */
function useDrivePreviewBlob(file: TripFile) {
  const { token, checked } = useGoogleProviderToken();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // amíg nem tudjuk, van-e token, ne induljunk el
      if (!checked) return;

      if (!file.drive_file_id) {
        setSrc(null);
        return;
      }

      if (!token) {
        setSrc(null);
        return;
      }

      const isImage = !!file.mime_type?.startsWith("image/");
      const isPdf = file.mime_type === "application/pdf";

      if (!isImage && !isPdf) {
        setSrc(null);
        return;
      }

      setLoading(true);

      try {
        const url = isPdf
          ? `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}/export?mimeType=image/png`
          : `https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setSrc(null);
          return;
        }

        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(objUrl);
          return;
        }

        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = objUrl;
        setSrc(objUrl);
      } catch {
        setSrc(null);
      } finally {
        if (!cancelled) setLoading(false);
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
  }, [file.id, file.drive_file_id, file.mime_type, token, checked]);

  return { src, loading, tokenReady: checked && !!token };
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

  const { src: previewSrc, loading: previewLoading, tokenReady } =
    useDrivePreviewBlob(file);

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

  const isImageLike =
    file.type === "photo" ||
    !!file.mime_type?.startsWith("image/") ||
    file.mime_type === "application/pdf";

  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onPreviewClick}
        className="block w-full overflow-hidden rounded-2xl h-40 sm:h-48 md:h-[200px] lg:h-[220px] xl:h-[240px]"
      >
        {previewLoading ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Betöltés...
          </div>
        ) : previewSrc ? (
          <img
            src={previewSrc}
            alt={file.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            {isImageLike && !tokenReady ? (
              <div className="text-center px-3">
                <div className="text-xs text-slate-500">Betöltés…</div>
                <div className="text-[10px] text-slate-400">(Google token)</div>
              </div>
            ) : (
              getFileIcon(file)
            )}
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
