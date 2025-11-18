import React from "react";

type TripFile = {
  id: string;
  type: "photo" | "document";
  name: string;
  drive_file_id: string;
  thumbnail_link: string | null;
  preview_link: string | null;
};

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
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-2">Fotók</h2>
      <p className="text-xs text-slate-500 mb-3">
        Képeket tölthetsz fel közvetlenül az eszközödről – a TripLog
        automatikusan elmenti őket az utazás Google Drive mappájába.
      </p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between gap-2">
          <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-center cursor-pointer hover:opacity-90 transition font-medium">
            {submittingPhoto ? "Feltöltés..." : "Feltöltés eszközről"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFileToDriveAndSave("photo", file);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {photoError && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
            {photoError}
          </div>
        )}

        {photoSuccess && (
          <div className="text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
            {photoSuccess}
          </div>
        )}
      </div>

      {loadingFiles && (
        <p className="text-[11px] text-slate-500">Fotók betöltése...</p>
      )}

      {filesError && (
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1 mb-2">
          {filesError}
        </div>
      )}

      {!loadingFiles && photoFiles.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Még nincs egyetlen fotó sem ehhez az utazáshoz.
        </p>
      )}

      {!loadingFiles && photoFiles.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {photoFiles.map((file) => (
            <div
              key={file.id}
              className="border border-slate-200 rounded-xl p-1.5 flex flex-col text-[11px]"
            >
              <a
                href={file.preview_link || "#"}
                target="_blank"
                rel="noreferrer"
                className="block mb-1"
              >
                {file.thumbnail_link ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.thumbnail_link}
                    alt={file.name}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center bg-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-500">
                      Nincs előnézet
                    </span>
                  </div>
                )}
              </a>

              <div className="flex flex-col gap-1">
                <p className="font-medium truncate">{file.name}</p>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleRenameFile(file)}
                    className="text-[10px] text-slate-600 underline"
                  >
                    Átnevezés
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(file.id, "photo")}
                    className="text-[10px] text-red-500 underline"
                  >
                    Törlés
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
