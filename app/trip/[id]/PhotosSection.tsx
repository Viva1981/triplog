"use client";

import { useState } from "react";
import Image from "next/image";
import type { TripFile } from "@/lib/trip/types";
import PhotoLightbox from "./components/PhotoLightbox";

type Props = {
  tripId: string;
  userId: string | null;
  files: TripFile[];
  providerToken: string | null;
  onRefresh: () => void;

  uploadFileToDriveAndSave: (file: File, type: "photo") => Promise<void>;
  handleRenameFile: (file: TripFile) => Promise<void>;
  handleDeleteFile: (fileId: string, type: "photo", driveFileId?: string) => Promise<void>;
};

export default function PhotosSection({
  files,
  userId,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);

  const next = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % files.length);
  };

  const prev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + files.length) % files.length);
  };

  const fileInput = (
    <input
      type="file"
      accept="image/*"
      className="hidden"
      id="photo-upload"
      onChange={async (e) => {
        if (e.target.files?.[0]) {
          await uploadFileToDriveAndSave(e.target.files[0], "photo");
        }
      }}
    />
  );

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Fotók</h2>
      <p className="text-sm text-slate-600 mb-3">
        Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog automatikusan elmenti őket az utazás Drive mappájába.
      </p>

      {/* Feltöltés */}
      <label
        htmlFor="photo-upload"
        className="mb-3 inline-block rounded-full bg-green-600 px-5 py-2 text-white cursor-pointer hover:bg-green-700"
      >
        Feltöltés
      </label>
      {fileInput}

      {/* Képek rács */}
      <div className="grid grid-cols-3 gap-3">
        {files.length === 0 && (
          <p className="col-span-3 text-sm text-slate-500 italic">Még nincs fotó feltöltve.</p>
        )}

        {files.map((file, idx) => (
          <div
            key={file.id}
            className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 shadow-sm cursor-pointer"
            onClick={() => openLightbox(idx)}
          >
            {file.thumbnail_link ? (
              <Image
                src={file.thumbnail_link}
                alt={file.name}
                fill
                className="object-cover"
                sizes="33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400 text-xs">
                Nincs előnézet
              </div>
            )}

            {/* Kebab menü csak a feltöltőnek */}
            {userId === file.user_id && (
              <div className="absolute top-1 right-1">
                <details className="relative">
                  <summary className="cursor-pointer select-none bg-white/70 backdrop-blur p-1 rounded-full shadow">
                    ⋮
                  </summary>
                  <div className="absolute right-0 mt-1 w-28 rounded-lg bg-white shadow-md ring-1 ring-slate-200 z-50">
                    <button
                      className="block w-full px-3 py-1 text-left text-sm hover:bg-slate-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameFile(file);
                      }}
                    >
                      Átnevezés
                    </button>
                    <button
                      className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-slate-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id, "photo", file.drive_file_id || undefined);
                      }}
                    >
                      Törlés
                    </button>
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Üzenet több utazónál */}
      {files.length > 0 && (
        <p className="text-xs text-slate-500 mt-3">
          Csak az általad feltöltött fotókat tudod átnevezni vagy törölni.
        </p>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          files={files}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </div>
  );
}
