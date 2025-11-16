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

type TripInvite = {
  trip_id: string;
  invited_email: string;
  role: "owner" | "member";
  status: "pending" | "accepted" | "cancelled" | "expired";
};

export default function JoinTripPage() {
  const router = useRouter();
  const params = useParams();
  const [state, setState] = useState<JoinState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  // A route param most már TOKEN, nem tripId
  const rawToken = params?.tripId;
  const token =
    typeof rawToken === "string" ? rawToken : rawToken?.[0] ?? undefined;

  useEffect(() => {
    const run = async () => {
      setState("checking");
      setMessage(null);

      // 1) Ha nincs token → hibás link
      if (!token) {
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

      // 3) Meghívó lekérdezése token alapján
      const { data: invite, error: inviteError } = await supabase
        .from("trip_invites")
        .select("trip_id, invited_email, role, status")
        .eq("token", token)
        .maybeSingle();

      if (inviteError) {
        console.error(inviteError);
        setState("error");
        setMessage(
          "Nem sikerült beolvasni a meghívót. Lehet, hogy lejárt vagy visszavonták."
        );
        return;
      }

      if (!invite) {
        setState("invalid-link");
        setMessage(
          "Ez a meghívó nem létezik vagy lejárt. Kérd meg az útitársadat, hogy küldjön új meghívót."
        );
        return;
      }

      const inviteData = invite as TripInvite;

      if (inviteData.status === "cancelled" || inviteData.status === "expired") {
        setState("error");
        setMessage(
          "Ez a meghívó már nem aktív. Kérd meg az útitársadat, hogy küldjön új meghívót."
        );
        return;
      }

      // 4) E-mail cím ellenőrzése
      const normalizedInviteEmail = inviteData.invited_email.toLowerCase();
      const normalizedUserEmail = (user.email ?? "").toLowerCase();

      if (!normalizedUserEmail) {
        setState("error");
        setMessage(
          "Nem sikerült beazonosítani a Google-fiókod e-mail címét. Ellenőrizd a fiók beállításait."
        );
        return;
      }

      if (normalizedInviteEmail !== normalizedUserEmail) {
        setState("error");
        setMessage(
          `Ezt a meghívót a(z) ${inviteData.invited_email} címre küldték, de most a(z) ${user.email} fiókkal vagy bejelentkezve. ` +
            "Lépj ki, és jelentkezz be a meghívott e-mail címmel."
        );
        return;
      }

      const tripId = inviteData.trip_id;

      // 5) Megnézzük, hogy már tag-e a user
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

      // 6) Ha még nem tag → felvesszük 'member' / 'accepted' státusszal (vagy az invite szerinti role-lal)
      setState("joining");
      setMessage("Csatlakozás az utazáshoz…");

      const { error: upsertError } = await supabase
        .from("trip_members")
        .upsert(
          {
            trip_id: tripId,
            user_id: user.id,
            role: inviteData.role ?? "member",
            status: "accepted",
          },
          { onConflict: "trip_id,user_id" }
        );

      if (upsertError) {
        console.error(upsertError);
        setState("error");
        setMessage(
          "Nem sikerült csatlakozni ehhez az utazáshoz. Lehet, hogy a meghívó lejárt vagy visszavonták."
        );
        return;
      }

      // Meghívó státusz frissítése (nem kötelező, de szép)
      try {
        await supabase
          .from("trip_invites")
          .update({ status: "accepted" })
          .eq("token", token);
      } catch (updateErr) {
        console.error("INVITE STATUS UPDATE ERROR:", updateErr);
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
  }, [token, router]);

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
