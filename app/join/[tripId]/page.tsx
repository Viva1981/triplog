
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type JoinState = "loading" | "success" | "already" | "error" | "no-user";

export default function JoinTripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params?.tripId === "string" ? params.tripId : "";

  const [state, setState] = useState<JoinState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!tripId) {
      setState("error");
      setErrorMessage("Hiányzik az utazás azonosítója a linkből.");
      return;
    }

    const run = async () => {
      // 1) User lekérése
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("no-user");
        return;
      }

      // 2) Megpróbáljuk felvenni az adott tripre
      const displayName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        null;

      const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: user.id,
        role: "member",
        status: "accepted",
        display_name: displayName,
        email: user.email,
      });

      if (insertError) {
        // Ha már tag (trip_id, user_id unique), akkor Postgres 23505 kódot kapunk.
        // Ezt "már útitárs vagy" kategóriának vesszük, nem hibának.
        // A Supabase hibánál a code mező string.
        const pgCode = (insertError as any).code;

        if (pgCode === "23505") {
          setState("already");
          // egy kis várakozás után irány a trip
          setTimeout(() => {
            router.replace(`/trip/${tripId}`);
          }, 1200);
          return;
        }

        console.error("JOIN TRIP INSERT ERROR:", insertError);
        setState("error");
        setErrorMessage(
          "Nem sikerült csatlakozni ehhez az utazáshoz. Lehet, hogy a link már nem érvényes, vagy nincs jogosultságod."
        );
        return;
      }

      // 3) Siker: mostantól accepted tag vagy → mehet a redirect
      setState("success");
      setTimeout(() => {
        router.replace(`/trip/${tripId}`);
      }, 1200);
    };

    run();
  }, [tripId, router]);

  let title = "Csatlakozás az utazáshoz…";
  let description = "Ellenőrizzük a jogosultságot és felveszünk útitársként.";
  let highlight = "";
  let highlightColor = "text-emerald-700";
  let buttonLabel = "Vissza a főoldalra";

  if (state === "no-user") {
    title = "Bejelentkezés szükséges";
    description =
      "Az utazáshoz való csatlakozáshoz először jelentkezz be a jobb felső sarokban.";
    highlight = "Miután beléptél, nyisd meg újra ezt a meghívó linket.";
    highlightColor = "text-slate-700";
  }

  if (state === "success") {
    title = "Sikeres csatlakozás 🎉";
    description = "Hozzáadtunk útitársként ehhez az utazáshoz.";
    highlight = "Mindjárt átirányítunk az utazás oldalára…";
  }

  if (state === "already") {
    title = "Már útitársa vagy ennek az utazásnak";
    description = "Ezt az utazást már korábban felvetted.";
    highlight = "Mindjárt megnyitjuk az utazás részleteit…";
  }

  if (state === "error") {
    title = "Hiba a csatlakozás közben";
    description = errorMessage || "Váratlan hiba történt.";
    highlight = "";
    highlightColor = "text-red-600";
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-100 p-5 text-center">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-600 mb-3">{description}</p>
        {highlight && (
          <p className={`text-xs ${highlightColor} mb-4`}>{highlight}</p>
        )}

        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium hover:opacity-90"
        >
          {buttonLabel}
        </button>
      </div>
    </main>
  );
}
