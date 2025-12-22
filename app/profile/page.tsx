"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// --- SVG IKONOK ---
const Icons = {
  Back: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Map: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Logout: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
};

type ProfileInfo = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string | null;
};

type PendingInvite = {
  id: string; // invite id (NEM member id)
  trip_id: string;
  trip: {
    title: string;
    destination: string | null;
  };
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [ownedCount, setOwnedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const name = (user.user_metadata as any)?.full_name ?? (user.user_metadata as any)?.name ?? null;
    const avatarUrl = (user.user_metadata as any)?.avatar_url ?? (user.user_metadata as any)?.picture ?? null;
    const provider = (user.app_metadata as any)?.provider ?? "email";

    setProfile({
      id: user.id,
      email: user.email ?? "",
      name,
      avatarUrl,
      provider
    });

    // 1. Saját utak
    const { count: owned } = await supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id);
    
    // 2. Közös utak
    const { count: shared } = await supabase
      .from("trip_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "member")
      .eq("status", "accepted");

    // 3. Függő meghívások - JAVÍTVA: TRIP_INVITES TÁBLÁBÓL!
    // Megkeressük azokat a meghívókat, amik erre az e-mailre szólnak
    if (user.email) {
      const { data: pendingData } = await supabase
        .from("trip_invites")
        .select(`
          id,
          trip_id,
          trip:trips (
            title,
            destination
          )
        `)
        .eq("invited_email", user.email) // Itt az e-mail alapján keresünk
        .eq("status", "pending");

      setOwnedCount(owned || 0);
      setSharedCount(shared || 0);
      
      if (pendingData) {
        const mappedInvites = pendingData.map((item: any) => ({
          id: item.id,
          trip_id: item.trip_id,
          trip: {
            title: item.trip?.title ?? "Névtelen utazás",
            destination: item.trip?.destination
          }
        }));
        setInvites(mappedInvites);
      }
    } else {
        setLoading(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [router]);

  // JAVÍTVA: Elfogadáskor létrehozzuk a TAGSÁGOT is
  const handleAcceptInvite = async (inviteId: string, tripId: string) => {
    if (!profile) return;

    // 1. Tag létrehozása
    const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: profile.id,
        role: "member",
        status: "accepted",
        display_name: profile.name,
        email: profile.email
    });

    // Ha már tag (23505 hiba), azt nem vesszük hibának
    if (insertError && insertError.code !== '23505') {
        console.error("Hiba a csatlakozáskor:", insertError);
        alert("Nem sikerült csatlakozni. Próbáld újra.");
        return;
    }

    // 2. Meghívó lezárása
    await supabase
      .from("trip_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId);
    
    loadData();
  };

  // Elutasításkor csak a meghívót állítjuk át (vagy töröljük)
  const handleDeclineInvite = async (inviteId: string) => {
    await supabase
      .from("trip_invites")
      .delete() // Vagy .update({ status: 'cancelled' })
      .eq("id", inviteId);
    
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#16ba53]"></div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-8">
        
        {/* Vissza gomb */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 transition">
            <Icons.Back /> <span className="ml-1">Vissza a főoldalra</span>
          </Link>
        </div>
        
        {/* FEJLÉC */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white p-1 shadow-md mb-4 relative">
            {profile.avatarUrl ? (
              <img 
                src={profile.avatarUrl} 
                alt={profile.name || "User"} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-[#16ba53] flex items-center justify-center text-3xl font-bold text-white uppercase">
                {profile.email.charAt(0)}
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div className="w-4 h-4 bg-blue-500 rounded-full" title={profile.provider || "email"}></div> 
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900">
            {profile.name || "Felhasználó"}
          </h1>
          <p className="text-sm text-slate-500">{profile.email}</p>
        </div>

        {/* MEGHÍVÁSOK */}
        {invites.length > 0 && (
          <section className="mb-8 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Függő meghívások</h2>
            </div>
            
            <div className="space-y-3">
              {invites.map(invite => (
                <div key={invite.id} className="bg-white rounded-2xl p-4 shadow-md border-l-4 border-orange-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-orange-600 font-bold mb-1">MEGHÍVÓ ÉRKEZETT</p>
                    <h3 className="font-bold text-slate-900">{invite.trip.title}</h3>
                    {invite.trip.destination && (
                      <p className="text-sm text-slate-500">{invite.trip.destination}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAcceptInvite(invite.id, invite.trip_id)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#16ba53] text-white text-xs font-bold hover:opacity-90 shadow-sm"
                    >
                      <Icons.Check /> <span className="ml-1">Elfogadás</span>
                    </button>
                    <button 
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                    >
                      <Icons.X /> <span className="ml-1">Elutasítás</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STATISZTIKA */}
        <section className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#16ba53] flex items-center justify-center mb-2">
              <Icons.Map />
            </div>
            <span className="text-2xl font-bold text-slate-900">{ownedCount}</span>
            <span className="text-xs text-slate-500 font-medium uppercase mt-1">Saját utazás</span>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
              <Icons.Users />
            </div>
            <span className="text-2xl font-bold text-slate-900">{sharedCount}</span>
            <span className="text-xs text-slate-500 font-medium uppercase mt-1">Közös utazás</span>
          </div>
        </section>

        {/* FIÓK ADATOK */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-800">Fiók adatai</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Szolgáltató</span>
              <span className="font-medium text-slate-800 capitalize">{profile.provider}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">User ID</span>
              <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">{profile.id.substring(0, 8)}...</span>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-red-600 font-bold text-sm py-2 hover:bg-red-50 rounded-xl transition"
            >
              <Icons.Logout /> Kijelentkezés
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-slate-300 mt-8">
          TripLog v1.0 • Built with Next.js & Supabase
        </p>

      </div>
    </main>
  );
}