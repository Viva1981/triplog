import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// A Header importot töröltük innen!

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Itt volt a <Header /> komponens, ezt kitöröltük, hogy ne legyen duplázódás */}
        {children}
      </body>
    </html>
  );
}