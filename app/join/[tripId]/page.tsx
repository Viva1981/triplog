
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

  // A dinamikus szegmens neve a fájlrendszerben [tripId], de valójában TOKEN-t tartalmaz.
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
      // 1) Auth: van-e bejelentkezett user?
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState("no-user");
        return;
      }

      // 2) Meghívó lekérése token alapján a trip_invites táblából
      const {
        data: invite,
        error: inviteError,
      } = await supabase
        .from("trip_invites")
        .select(
          "id, trip_id, status, role, invited_email"
        )
        .eq("token", token)
        .single<TripInvite>();

      if (inviteError || !invite) {
        console.error("JOIN TRIP INVITE ERROR:", inviteError);
        setState("error");
        setErrorMessage(
          "Ez a meghívó nem található. Lehet, hogy lejárt vagy már törölték."
        );
        return;
      }

      // Ha nagyon szigorúak akarunk lenni, itt lehetne státuszt ellenőrizni (pending/expired stb.)

      const tripId = invite.trip_id;

      // 3) Megpróbáljuk felvenni a usert a trip_members-be
      const displayName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        null;

      const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: user.id,
        role: invite.role || "member",
        status: "accepted",
        display_name: displayName,
        email: user.email,
      });

      if (insertError) {
        const pgCode = (insertError as any).code;
        console.error("JOIN TRIP INSERT ERROR:", insertError);

        // 23505 = unique_violation (trip_id, user_id) → már tag
        if (pgCode === "23505") {
          setState("already");
          setTimeout(() => {
            router.replace(`/trip/${tripId}`);
          }, 1200);
          return;
        }

        // 23503 = foreign_key_violation → meghívó olyan tripre mutat, ami már nem létezik
        if (pgCode === "23503") {
          setState("error");
          setErrorMessage(
            "Ez a meghívó már egy nem létező utazásra mutat. Lehet, hogy törölték az utazást."
          );
          return;
        }

        setState("error");
        setErrorMessage(
          "Nem sikerült csatlakozni ehhez az utazáshoz. Lehet, hogy a link már nem érvényes, vagy nincs jogosultságod."
        );
        return;
      }

      // 4) Siker: accepted member lett
      setState("success");
      setTimeout(() => {
        router.replace(`/trip/${tripId}`);
      }, 1200);
    };

    run();
  }, [token, router]);

  // --- UI állapotok --------------------------------------------------------

  let title = "Csatlakozás az utazáshoz…";
  let description = "Ellenőrizzük a meghívót és felveszünk útitársként.";
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
