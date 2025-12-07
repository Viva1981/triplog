import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { SwRegister } from "./sw-register";
import { Header } from "./Header";

export const metadata: Metadata = {
  title: "TripLog",
  description:
    "Utazások tervezése, dokumentálása és költségkezelés egy helyen.",
  themeColor: "#16ba53",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <head />
      <body className="bg-slate-50">
        <SwRegister />
        <Header />
        {children}
      </body>
    </html>
  );
}
