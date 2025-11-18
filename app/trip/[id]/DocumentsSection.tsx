import React from "react";

type TripFile = {
  id: string;
  type: "photo" | "document";
  name: string;
  drive_file_id: string;
  thumbnail_link: string | null;
  preview_link: string | null;
};

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
}: DocumentsSectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-4 border border-slate-100">
      <h2 className="text-sm font-semibold mb-2">Dokumentumok</h2>
      <p className="text-xs text-slate-500 mb-3">
        Foglalások, beszállókártyák, jegyek és más fontos dokumentumok – töltsd
        fel őket közvetlenül az eszközödről, mi elmentjük az utazás mappájába.
      </p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between gap-2">
          <label className="flex-1 text-[11px] px-3 py-1.5 rounded-xl bg-[#16ba53] text-white text-center cursor-pointer hover:opacity-90 transition font-medium">
            {submittingDoc ? "Feltöltés..." : "Feltöltés eszközről"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFileToDriveAndSave("document", file);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>

        {docError && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1">
            {docError}
          </div>
        )}

        {docSuccess && (
          <div className="text-[11px] text-green-700 bg-green-50 border border-green-100 rounded-xl px-2 py-1">
            {docSuccess}
          </div>
        )}
      </div>

      {loadingFiles && (
        <p className="text-[11px] text-slate-500">Dokumentumok betöltése...</p>
      )}

      {filesError && (
        <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1 mb-2">
          {filesError}
        </div>
      )}

      {!loadingFiles && docFiles.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Még nincs egyetlen dokumentum sem ehhez az utazáshoz.
        </p>
      )}

      {!loadingFiles && docFiles.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
          {docFiles.map((file) => (
            <div
              key={file.id}
              className="border border-slate-200 rounded-xl p-2 flex flex-col text-[11px]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <a
                  href={file.preview_link || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium truncate text-slate-800 underline"
                >
                  {file.name}
                </a>
              </div>

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
                  onClick={() => handleDeleteFile(file.id, "document")}
                  className="text-[10px] text-red-500 underline"
                >
                  Törlés
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
