import React from "react";
import type { TripFile } from "../../../lib/trip/types";
import FileCard from "./components/FileCard";

type PhotosSectionProps = {
  photoFiles: TripFile[];
  loadingFiles: boolean;
  filesError: string | null;
  submittingPhoto: boolean;
  photoError: string | null;
  photoSuccess: string | null;
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
};

export default function PhotosSection({
  photoFiles,
  loadingFiles,
  filesError,
  submittingPhoto,
  photoError,
  photoSuccess,
  uploadFileToDriveAndSave,
  handleRenameFile,
  handleDeleteFile,
}: PhotosSectionProps) {
  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFileToDriveAndSave("photo", file);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      {/* Fejléc */}
      <div className="mb-3">
        <h2 className="text-sm font-semibold mb-1">Fotók</h2>
        <p className="text-xs text-slate-500">
          Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
          automatikusan elmenti őket az utazás Google Drive mappájába.
        </p>
      </div>

      {/* Feltöltő sáv */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between gap-2">
          <label className="flex-1 text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 cursor-pointer hover:bg-slate-100 transition font-medium text-center">
            {submittingPhoto ? "Feltöltés..." : "Feltöltés eszközről"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={submittingPhoto}
              onChange={handlePhotoChange}
            />
          </label>
        </div>

        {photoError && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
            {photoError}
          </div>
        )}
        {photoSuccess && (
          <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-2 py-1">
            {photoSuccess}
          </div>
        )}
      </div>

      {filesError && (
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1 mb-2">
          {filesError}
        </div>
      )}

      {loadingFiles ? (
        <p className="text-[11px] text-slate-500">Fotók betöltése...</p>
      ) : photoFiles.length === 0 ? (
        <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center">
          <p className="text-[12px] font-medium text-slate-700 mb-1">
            Még nincs feltöltött fotó.
          </p>
          <p className="text-[11px] text-slate-500">
            Tölts fel egy képet az eszközödről, hogy elkezdődjön az utazás
            fotónaplója.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photoFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onRename={(id, newName) => {
                const updated: TripFile = { ...file, name: newName };
                handleRenameFile(updated);
              }}
              onDelete={(id) => {
                handleDeleteFile(id, "photo", file.drive_file_id || undefined);
              }}
              // NINCS onOpen → fotóknál nem nyitjuk Drive-ban
            />
          ))}
        </div>
      )}
    </section>
  );
}
