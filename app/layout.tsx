import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthGuard from "./AuthGuard"; // <--- 1. Importáljuk az őrszemet

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TripLog",
  description: "Utazás szervező és költségkövető alkalmazás",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body className={inter.className}>
        <AuthGuard /> {/* <--- 2. Betesszük ide, hogy mindig fusson a háttérben */}
        {children}
      </body>
    </html>
  );
}