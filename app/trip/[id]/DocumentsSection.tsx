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
  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFileToDriveAndSave("document", f);
    e.target.value = "";
  };

  // Segédfüggvény a megnyitáshoz
  const openInDrive = (file: TripFile) => {
    if (file.drive_file_id) {
      // Ez a standard Google Drive nézegető linkje
      window.open(
        `https://drive.google.com/file/d/${file.drive_file_id}/view`,
        "_blank"
      );
    }
  };

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dokumentumok
          </h2>
          <p className="text-xs text-slate-500">
            PDF-ek, jegyek, igazolások.
          </p>
          {docFiles.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              {docFiles.length} fájl
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

      {(docError || filesError) && (
        <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {docError || filesError}
        </div>
      )}

      {docSuccess && (
        <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {docSuccess}
        </div>
      )}

      {loadingFiles ? (
        <div className="text-xs text-slate-400">Betöltés…</div>
      ) : docFiles.length === 0 ? (
        <div className="text-xs text-slate-400">Még nincs dokumentum.</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {docFiles.map((file) => {
            const canManage = !!currentUserId && file.user_id === currentUserId;

            return (
              <FileCard
                key={file.id}
                file={file}
                canManage={canManage}
                // Itt a lényeg: Lightbox helyett sima Drive megnyitás
                onPreviewClick={() => openInDrive(file)}
                onOpen={() => openInDrive(file)}
                onRename={() => handleRenameFile(file)}
                onDelete={() =>
                  handleDeleteFile(file.id, "document", file.drive_file_id)
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}