import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Helyi fájlok helyett a beépített Google Inter betűtípust használjuk
// Ez sokkal stabilabb és nem okoz "File not found" hibát
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
        {/* A Header-t innen már kivettük, így nem lesz duplázódás */}
        {children}
      </body>
    </html>
  );
}