"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type JoinState =
  | "checking"
  | "needs-login"
  | "joining"
  | "joined"
  | "error"
  | "invalid-link";

export default function JoinTripPage() {
  const router = useRouter();
  const params = useParams();
  const [state, setState] = useState<JoinState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  // route param kinyerése biztonságosan
  const rawTripId = params?.tripId;
  const tripId =
    typeof rawTripId === "string" ? rawTripId : rawTripId?.[0] ?? undefined;

  useEffect(() => {
    const run = async () => {
      setState("checking");
      setMessage(null);

      // 1) Ha valamiért nincs tripId a URL-ben → hibás link
      if (!tripId) {
        setState("invalid-link");
        setMessage(
          "Érvénytelen meghívó link. Ellenőrizd, hogy teljes egészében másoltad-e ki."
        );
        return;
      }

      // 2) User ellenőrzése
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
        setState("error");
        setMessage("Hiba történt a bejelentkezés ellenőrzésekor.");
        return;
      }

      if (!user) {
        setState("needs-login");
        setMessage(
          "Ez egy utazás-meghívó link. Kérlek jelentkezz be a jobb felső 'Bejelentkezés Google-lel' gombbal. Bejelentkezés után automatikusan visszatérsz ide."
        );
        return;
      }

      // 3) Megnézzük, hogy már tag-e a user (trip_members)
      const { data: existingMembers, error: memberError } = await supabase
        .from("trip_members")
        .select("id, status, role")
        .eq("trip_id", tripId)
        .eq("user_id", user.id);

      if (memberError) {
        console.error(memberError);
      }

      if (existingMembers && existingMembers.length > 0) {
        setState("joined");
        setMessage(
          "Már tagja vagy ennek az utazásnak. Átirányítunk az utazás oldalára…"
        );
        setTimeout(() => {
          router.push(`/trip/${tripId}`);
        }, 1500);
        return;
      }

      // 4) Ha még nem tag → felvesszük 'member' / 'accepted' státusszal.
      setState("joining");
      setMessage("Csatlakozás az utazáshoz…");

      const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: user.id,
        role: "member",
        status: "accepted",
      });

      if (insertError) {
        // UNIQUE constraint esetén tekintsük úgy, hogy sikerült (valaki párhuzamosan már felvette).
        if ((insertError as any).code === "23505") {
          setState("joined");
          setMessage(
            "Már tagja vagy ennek az utazásnak. Átirányítunk az utazás oldalára…"
          );
          setTimeout(() => {
            router.push(`/trip/${tripId}`);
          }, 1500);
          return;
        }

        console.error(insertError);
        setState("error");
        setMessage(
          "Nem sikerült csatlakozni ehhez az utazáshoz. Lehet, hogy a meghívó lejárt vagy visszavonták."
        );
        return;
      }

      setState("joined");
      setMessage(
        "Sikeresen csatlakoztál az utazáshoz! Átirányítunk az utazás oldalára…"
      );
      setTimeout(() => {
        router.push(`/trip/${tripId}`);
      }, 1500);
    };

    run();
  }, [tripId, router]);

  const renderContent = () => {
    switch (state) {
      case "checking":
      case "joining":
        return <p>{message ?? "Ellenőrzés…"}</p>;
      case "needs-login":
      case "error":
      case "invalid-link":
      case "joined":
        return <p>{message}</p>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">
          Utazáshoz csatlakozás
        </h1>
        <p className="text-sm text-slate-600">
          Ezt a linket egy útitársadtól kaptad. Ha még nem tetted, jelentkezz
          be a jobb felső gombbal Google-fiókoddal.
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
