import React, { type ReactNode } from "react";
import { TripFile } from "./types";

export function getFileIcon(file: TripFile): ReactNode {
  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return <span className="text-4xl text-red-500">📄</span>;
    case "doc":
    case "docx":
      return <span className="text-4xl text-blue-500">📘</span>;
    case "xls":
    case "xlsx":
      return <span className="text-4xl text-green-500">📗</span>;
    case "zip":
    case "rar":
      return <span className="text-4xl text-yellow-500">🗜️</span>;
    default:
      return <span className="text-4xl text-slate-500">📁</span>;
  }
}
