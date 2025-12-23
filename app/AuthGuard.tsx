"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard() {
  const router = useRouter();

  useEffect(() => {
    // Figyeljük a Supabase eseményeit
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 1. ESET: Kijelentkezés történt (bárhol az appban)
      if (event === "SIGNED_OUT") {
        // Törlünk mindent a böngésző gyorsítótárából és visszavisszük a főoldalra
        window.location.href = "/";
      }
      
      // 2. ESET: Lejárt a token és nem sikerült frissíteni (pl. reggelre)
      // JAVÍTÁS: (event as string) használata a TypeScript hiba elkerülésére
      if ((event as string) === "TOKEN_REFRESH_ERROR") {
        console.warn("Lejárt a munkamenet, kijelentkeztetés...");
        // Kényszerített kijelentkezés és frissítés
        supabase.auth.signOut();
        window.location.href = "/";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Ez egy láthatatlan komponens, nem renderel semmit
  return null;
}