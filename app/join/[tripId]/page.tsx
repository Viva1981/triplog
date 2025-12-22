"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type JoinState = "loading" | "success" | "already" | "error" | "no-user";

type TripInvite = {
  id: string;
  trip_id: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  role: "owner" | "member";
  invited_email: string;
};

export default function JoinTripPage() {
  const params = useParams();
  const router = useRouter();

  // A route paraméter a fájlnév miatt tripId, de valójában ez a TOKEN
  const token = typeof params?.tripId === "string" ? params.tripId : "";

  const [state, setState] = useState<JoinState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("Hiányzik a meghívó token a linkből.");
      return;
    }

    const run = async () => {
      // 1) Auth ellenőrzés
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("no-user");
        return;
      }

      // 2) Meghívó keresése
      const { data: invite, error: inviteError } = await supabase
        .from("trip_invites")
        .select("id, trip_id, status, role, invited_email")
        .eq("token", token)
        .single<TripInvite>();

      if (inviteError || !invite) {
        console.error("JOIN TRIP INVITE ERROR:", inviteError);
        setState("error");
        setErrorMessage("Ez a meghívó nem található. Lehet, hogy lejárt vagy már törölték.");
        return;
      }

      const tripId = invite.trip_id;

      // 3) Tag felvétele (trip_members)
      const displayName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        null;

      const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: user.id,
        role: invite.role || "member",
        status: "accepted", // Azonnal elfogadott
        display_name: displayName,
        email: user.email,
      });

      // 4) Hiba és Duplikáció kezelése + Meghívó lezárása
      if (insertError) {
        const pgCode = (insertError as any).code;

        // 23505 = Már tag (unique violation)
        if (pgCode === "23505") {
          // Ha már tag, akkor is lezárjuk a meghívót, hogy ne maradjon "pending"
          await supabase
            .from("trip_invites")
            .update({ status: "accepted" })
            .eq("id", invite.id);

          setState("already");
          setTimeout(() => router.replace(`/trip/${tripId}`), 1200);
          return;
        }

        // 23503 = Nem létező trip
        if (pgCode === "23503") {
          setState("error");
          setErrorMessage("Ez a meghívó már egy nem létező utazásra mutat.");
          return;
        }

        console.error("JOIN ERROR:", insertError);
        setState("error");
        setErrorMessage("Nem sikerült csatlakozni. Lehet, hogy a link érvénytelen.");
        return;
      }

      // 5) SIKER: Meghívó státusz frissítése (EZ HIÁNYZOTT!)
      // Most, hogy sikeresen belépett, a meghívót átállítjuk 'accepted'-re
      await supabase
        .from("trip_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      setState("success");
      setTimeout(() => {
        router.replace(`/trip/${tripId}`);
      }, 1200);
    };

    run();
  }, [token, router]);

  // --- UI Állapotok (Clean UI) ---

  let title = "Csatlakozás folyamatban...";
  let description = "Ellenőrizzük a meghívót és felveszünk útitársként.";
  let highlight = "";
  let highlightColor = "text-[#16ba53]";
  let buttonLabel = "Vissza a főoldalra";

  if (state === "no-user") {
    title = "Bejelentkezés szükséges";
    description = "Az utazáshoz való csatlakozáshoz először jelentkezz be.";
    highlight = "Miután beléptél, kattints újra a meghívó linkre.";
    highlightColor = "text-slate-600";
  }

  if (state === "success") {
    title = "Sikeres csatlakozás";
    description = "Hozzáadtunk útitársként az utazáshoz.";
    highlight = "Átirányítás az utazás oldalára...";
  }

  if (state === "already") {
    title = "Már útitárs vagy";
    description = "Ezt az utazást már korábban felvetted a listádra.";
    highlight = "Utazás megnyitása...";
  }

  if (state === "error") {
    title = "Hiba történt";
    description = errorMessage || "Váratlan hiba.";
    highlight = "";
    highlightColor = "text-red-600";
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
        {state === "loading" && (
           <div className="mb-4 flex justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#16ba53]"></div>
           </div>
        )}
        
        <h1 className="text-lg font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-600 mb-4">{description}</p>
        
        {highlight && (
          <p className={`text-xs font-medium ${highlightColor} mb-6`}>{highlight}</p>
        )}

        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#16ba53] text-white text-sm font-bold hover:opacity-90 transition shadow-sm active:scale-95"
        >
          {buttonLabel}
        </button>
      </div>
    </main>
  );
}