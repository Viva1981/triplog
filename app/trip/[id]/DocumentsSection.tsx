"use client";

import React from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./components/FileCard";

type DocumentsSectionProps = {
  docFiles: TripFile[];
  loadingFiles: boolean;
  filesError: string | null;
  submittingDoc: boolean;
  docError: string | null;
  docSuccess: string | null;
  uploadFileToDriveAndSave: (
    type: "photo" | "document",
    file: File
  ) => Promise<void> | void;
  handleRenameFile: (file: TripFile) => Promise<void> | void;
  handleDeleteFile: (
    fileId: string,
    type: "photo" | "document",
    driveFileId?: string
  ) => Promise<void> | void;
  currentUserId?: string | null;
};

export default function DocumentsSection({
  docFiles,
  loadingFiles,
  filesError,
  submittingDoc,
  docError,
  docSuccess,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
  currentUserId,
}: DocumentsSectionProps) {
  const handleDocChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("document", file);
    event.target.value = "";
  };

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dokumentumok
          </h2>
          <p className="text-xs text-slate-500">
            Foglalások, beszállókártyák, jegyek és más fontos dokumentumok –
            töltsd fel őket közvetlenül az eszközödről, mi elmentjük az utazás
            mappájába.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
          <input
            type="file"
            className="hidden"
            onChange={handleDocChange}
            disabled={submittingDoc}
          />
          {submittingDoc ? "Feltöltés..." : "Feltöltés eszközről"}
        </label>
      </div>

      {/* státusz üzenetek */}
      {docError && (
        <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {docError}
        </div>
      )}
      {docSuccess && (
        <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {docSuccess}
        </div>
      )}
      {filesError && (
        <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {filesError}
        </div>
      )}

      {/* lista */}
      {loadingFiles ? (
        <div className="mt-4 text-xs text-slate-500">
          Dokumentumok betöltése...
        </div>
      ) : docFiles.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Még nincs egyetlen dokumentum sem ehhez az utazáshoz.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {docFiles.map((file) => {
              const canManage =
                file.user_id && currentUserId
                  ? file.user_id === currentUserId
                  : true;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  onRename={(id, newName) => {
                    const updated: TripFile = { ...file, name: newName };
                    handleRenameFile(updated);
                  }}
                  onDelete={(id) => {
                    // itt is csak string | undefined mehet
                    handleDeleteFile(id, "document", file.drive_file_id);
                  }}
                  onOpen={() => {
                    const url =
                      file.preview_link || file.thumbnail_link || undefined;
                    if (url) {
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                />
              );
            })}
          </div>

          <p className="mt-3 text-[11px] leading-snug text-slate-500">
            Csak az általad feltöltött dokumentumokat tudod átnevezni vagy
            törölni az alkalmazásból. Más utazók anyagaihoz továbbra is
            hozzáférsz a Google Drive jogosultságai alapján, de a törlést és
            átnevezést ők tudják elvégezni.
          </p>
        </>
      )}
    </section>
  );
}
