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

  /**
   * Megnyitja a fájlt a Google Drive beépített nézegetőjében (új fülön).
   * Ez a legbiztosabb módja a PDF-ek, Doc-ok kezelésének.
   */
  const openInDrive = (file: TripFile) => {
    if (file.drive_file_id) {
      window.open(
        `https://drive.google.com/file/d/${file.drive_file_id}/view`,
        "_blank"
      );
    }
  };

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5 h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Dokumentumok
          </h2>
          <p className="text-xs text-slate-500">
            PDF-ek, jegyek, igazolások.
          </p>
          {docFiles.length > 0 && (
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {docFiles.length} fájl feltöltve
            </p>
          )}
        </div>

        <label className="group inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-600 hover:shadow-md hover:scale-105 active:scale-95">
          <input
            type="file"
            className="hidden"
            onChange={handleDocChange}
            disabled={submittingDoc}
          />
          {submittingDoc ? (
             <span className="flex items-center gap-2">
               <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Feltöltés...
             </span>
          ) : (
             "Feltöltés"
          )}
        </label>
      </div>

      {(docError || filesError) && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs font-medium text-red-700">
          ⚠️ {docError || filesError}
        </div>
      )}

      {docSuccess && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs font-medium text-emerald-700 flex items-center gap-2">
          ✅ {docSuccess}
        </div>
      )}

      {loadingFiles ? (
        <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500 mb-2"></div>
            <p className="text-xs text-slate-400">Dokumentumok betöltése...</p>
        </div>
      ) : docFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50">
          <div className="text-2xl mb-2">📂</div>
          <p className="text-sm font-medium text-slate-600">Még nincs dokumentum</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
            Töltsd fel a szállásfoglalást, repjegyet vagy biztosítást.
          </p>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-4">
          {docFiles.map((file) => {
            const canManage = !!currentUserId && file.user_id === currentUserId;

            return (
              <FileCard
                key={file.id}
                file={file}
                canManage={canManage}
                // Itt a logika: Kattintásra Drive megnyitás
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