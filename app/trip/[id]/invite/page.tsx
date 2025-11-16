"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Trip = {
  id: string;
  title: string | null;
  owner_id: string;
  drive_folder_id: string | null;
};

export default function TripInvitePage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [invitedEmail, setInvitedEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [driveWarning, setDriveWarning] = useState<string | null>(null);

  const rawId = params?.id;
  const tripId = typeof rawId === "string" ? rawId : rawId?.[0] ?? undefined;

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      if (!tripId) {
        setError(
          "Érvénytelen utazás azonosító. Ellenőrizd, hogy helyes linket nyitottál-e meg."
        );
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(userError);
        setError("Hiba történt a bejelentkezés ellenőrzésekor.");
        setLoading(false);
        return;
      }

      if (!user) {
        setError(
          "Ehhez a meghívóhoz be kell jelentkezned. Használd a jobb felső 'Bejelentkezés Google-lel' gombot."
        );
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);

      // Betöltjük a tripet, és ellenőrizzük, hogy a user az owner-e
      const { data: tripData, error: tripError } = await supabase
        .from("trips")
        .select("id, title, owner_id, drive_folder_id")
        .eq("id", tripId)
        .maybeSingle();

      if (tripError || !tripData) {
        console.error(tripError);
        setError(
          "Nincs jogosultságod ehhez az utazáshoz, vagy az utazás nem létezik."
        );
        setLoading(false);
        return;
      }

      if (tripData.owner_id !== user.id) {
        setError("Csak az utazás tulajdonosa hozhat létre meghívókat.");
        setLoading(false);
        return;
      }

      setTrip({
        id: tripData.id,
        title: tripData.title ?? null,
        owner_id: tripData.owner_id,
        drive_folder_id: tripData.drive_folder_id ?? null,
      });

      setLoading(false);
    };

    init();
  }, [tripId]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Meghívó link vágólapra másolva! 👌");
    } catch (err) {
      console.error(err);
      alert("Nem sikerült a vágólapra másolni. Másold ki kézzel.");
    }
  };

  const handleBackToTrip = () => {
    if (!tripId) return;
    router.push(`/trip/${tripId}`);
  };

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    setInviteError(null);
    setInviteSuccess(null);
    setDriveWarning(null);
    setInviteUrl("");

    const email = invitedEmail.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      setInviteError("Adj meg egy érvényes e-mail címet.");
      return;
    }

    setCreatingInvite(true);

    try {
      // Generálunk egy random tokent az invite linkhez
      const token =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${trip.id}-${Date.now()}`;

      // 1) Meghívó sor létrehozása
      const { data: inviteRow, error: inviteInsertError } = await supabase
        .from("trip_invites")
        .insert({
          trip_id: trip.id,
          invited_email: email,
          role: "member",
          token,
        })
        .select("token")
        .single();

      if (inviteInsertError || !inviteRow) {
        console.error(inviteInsertError);
        setInviteError(
          inviteInsertError?.message ??
            "Nem sikerült létrehozni a meghívót. Próbáld újra később."
        );
        return;
      }

      // 2) Meghívott hozzáadása Drive mappa jogosultsághoz (ha van mappa és Google token)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const accessToken = session?.provider_token as string | undefined;

        if (!trip.drive_folder_id) {
          setDriveWarning(
            "Figyelem: ehhez az utazáshoz még nincs Drive mappa. A meghívott nem kap automatikus jogosultságot, amíg nem hozol létre mappát/fájlt."
          );
        } else if (!accessToken) {
          setDriveWarning(
            "Nem találtam Google hozzáférési tokent. Lehet, hogy újra be kell jelentkezned, hogy a Drive jogosultságok is beálljanak."
          );
        } else {
          const permRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${trip.drive_folder_id}/permissions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                role: "writer", // vagy "reader", ha csak olvasást akarsz
                type: "user",
                emailAddress: email,
              }),
            }
          );

          if (!permRes.ok) {
            const txt = await permRes.text();
            console.error("DRIVE PERMISSION ERROR:", txt);
            setDriveWarning(
              "A meghívó létrejött, de a Drive jogosultság beállítása nem sikerült. A mappát manuálisan kell megosztanod a Google Drive-ban."
            );
          }
        }
      } catch (driveErr: any) {
        console.error("DRIVE PERMISSION SET ERROR:", driveErr);
        setDriveWarning(
          "A meghívó létrejött, de hiba történt a Drive jogosultság beállításakor."
        );
      }

      // 3) Meghívó link összeállítása
      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/join/${inviteRow.token}`;
        setInviteUrl(url);
      }

      setInviteSuccess(
        "Meghívó létrehozva. Másold ki a linket, és küldd el az útitársnak."
      );
      setInvitedEmail("");
    } catch (err: any) {
      console.error("CREATE INVITE ERROR:", err);
      setInviteError(err?.message ?? "Ismeretlen hiba történt a meghívó létrehozásakor.");
    } finally {
      setCreatingInvite(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Utazás meghívók
        </h1>

        {loading && <p>Betöltés…</p>}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && trip && (
          <div className="space-y-5">
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                Utazás:{" "}
                <span className="font-medium">{trip.title ?? "Névtelen utazás"}</span>
              </p>
              {userEmail && (
                <p className="text-xs text-slate-500">
                  Meghívókat ezzel a fiókkal hozod létre:{" "}
                  <span className="font-mono">{userEmail}</span>
                </p>
              )}
              <p className="text-xs text-slate-500">
                Az itt létrehozott meghívók e-mail címhez kötöttek. A meghívott
                csak akkor tud csatlakozni, ha ugyanazzal az e-mail címmel
                jelentkezik be, amit itt megadsz.
              </p>
            </div>

            {/* Új meghívó létrehozása e-mail alapján */}
            <form
              onSubmit={handleCreateInvite}
              className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <h2 className="text-sm font-semibold text-slate-800 mb-1">
                Útitárs meghívása e-mail címmel
              </h2>
              <p className="text-xs text-slate-600 mb-2">
                Add meg annak a Google-fióknak az e-mail címét, akit meg szeretnél
                hívni. A meghívott szerkesztői jogot kap az utazás Google Drive
                mappájához.
              </p>

              <input
                type="email"
                required
                value={invitedEmail}
                onChange={(e) => {
                  setInvitedEmail(e.target.value);
                  setInviteError(null);
                  setInviteSuccess(null);
                  setDriveWarning(null);
                }}
                placeholder="pl. barat@gmail.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {inviteError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {inviteSuccess}
                </div>
              )}

              {driveWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {driveWarning}
                </div>
              )}

              <button
                type="submit"
                disabled={creatingInvite}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {creatingInvite ? "Meghívó létrehozása…" : "Meghívó létrehozása"}
              </button>
            </form>

            {/* Létrehozott link megjelenítése / másolása */}
            {inviteUrl && (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">
                  Meghívó link
                </p>
                <p className="text-xs text-slate-600">
                  Ezt a linket küldd el az útitársnak. Ha megnyitja, és a
                  meghívott e-mail címmel lép be, automatikusan tagja lesz az
                  utazásnak.
                </p>
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                  >
                    Link másolása
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToTrip}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Vissza az utazáshoz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
