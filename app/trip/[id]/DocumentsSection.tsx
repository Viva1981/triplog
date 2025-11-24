"use client";

import React from "react";
import type { TripFile } from "@/lib/trip/types";
import FileCard from "./FileCard";

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

const DocumentsSection: React.FC<DocumentsSectionProps> = ({
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
}) => {
  const handleDocChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFileToDriveAndSave("document", file);
    event.target.value = "";
  };

  const hasOtherUploader =
    !!currentUserId &&
    docFiles.some(
      (file) => file.user_id && file.user_id !== currentUserId
    );

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      {/* Fejléc */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dokumentumok
          </h2>
          <p className="text-xs text-slate-500">
            Foglalások, beszállókártyák, jegyek és más fontos
            dokumentumok – töltsd fel őket közvetlenül az eszközödről,
            mi elmentjük az utazás Google Drive mappájába.
          </p>
          {docFiles.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Összesen {docFiles.length} dokumentum.
            </p>
          )}
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600">
          <input
            type="file"
            className="hidden"
            onChange={handleDocChange}
            disabled={submittingDoc}
          />
          {submittingDoc ? "Feltöltés..." : "Feltöltés"}
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

      {/* lista / állapot */}
      {loadingFiles ? (
        <div className="mt-4 text-xs text-slate-500">
          Dokumentumok betöltése...
        </div>
      ) : docFiles.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Még nincs dokumentum ehhez az utazáshoz.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {docFiles.map((file) => {
              const canManage =
                !!currentUserId &&
                !!file.user_id &&
                file.user_id === currentUserId;

              return (
                <FileCard
                  key={file.id}
                  file={file}
                  canManage={canManage}
                  // Dokumentumoknál: kebab menüben is legyen "Megnyitás"
                  onOpen={() => {
                    if (file.preview_link) {
                      window.open(
                        file.preview_link,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }
                  }}
                  onRename={() => handleRenameFile(file)}
                  onDelete={() =>
                    handleDeleteFile(
                      file.id,
                      "document",
                      file.drive_file_id
                    )
                  }
                />
              );
            })}
          </div>

          {hasOtherUploader && (
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              Csak az általad feltöltött dokumentumokat tudod átnevezni
              vagy törölni az alkalmazásból. A többiek által feltöltött
              fájlok kezelése a Google Drive jogosultságaitól függ.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default DocumentsSection;
