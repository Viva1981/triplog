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
  Mail: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Logout: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Pencil: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Save: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

type ProfileInfo = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string | null;
};

type PendingInvite = {
  id: string;
  trip_id: string;
  trip: {
    title: string;
    destination: string | null;
  };
  inviterName: string | null; // ÚJ MEZŐ: A meghívó neve
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  const [ownedCount, setOwnedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    setNewName(name || "");

    const { data: ownedTrips } = await supabase
      .from("trips")
      .select("date_from, date_to")
      .eq("owner_id", user.id);
    
    const { data: sharedMemberships } = await supabase
      .from("trip_members")
      .select("trip:trips(date_from, date_to)")
      .eq("user_id", user.id)
      .eq("role", "member")
      .eq("status", "accepted");

    let days = 0;
    const calculateDays = (d1: string | null, d2: string | null) => {
        if (!d1 || !d2) return 0;
        const start = new Date(d1);
        const end = new Date(d2);
        const diff = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    ownedTrips?.forEach(t => days += calculateDays(t.date_from, t.date_to));
    sharedMemberships?.forEach((m: any) => {
        if (m.trip) days += calculateDays(m.trip.date_from, m.trip.date_to);
    });

    setTotalDays(days);
    setOwnedCount(ownedTrips?.length || 0);
    setSharedCount(sharedMemberships?.length || 0);

    // MEGHÍVÁSOK LEKÉRÉSE (BŐVÍTETT)
    if (user.email) {
      const { data: pendingData } = await supabase
        .from("trip_invites")
        .select(`
          id,
          trip_id,
          trip:trips (
            title,
            destination,
            trip_members (
              display_name,
              email,
              role
            )
          )
        `)
        .eq("invited_email", user.email)
        .eq("status", "pending");
      
      if (pendingData) {
        const mappedInvites = pendingData.map((item: any) => {
          // Megkeressük a tulajdonost a tagok közül
          const owner = item.trip?.trip_members?.find((m: any) => m.role === 'owner');
          const inviterName = owner?.display_name || owner?.email || "Ismeretlen";

          return {
            id: item.id,
            trip_id: item.trip_id,
            trip: {
              title: item.trip?.title ?? "Névtelen utazás",
              destination: item.trip?.destination
            },
            inviterName
          };
        });
        setInvites(mappedInvites);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({
        data: { full_name: newName }
    });
    if (!error) {
        setProfile(prev => prev ? ({ ...prev, name: newName }) : null);
        setIsEditingName(false);
    } else {
        alert("Nem sikerült frissíteni a nevet.");
    }
    setSavingName(false);
  };

  const handleAcceptInvite = async (inviteId: string, tripId: string) => {
    if (!profile) return;
    const { error: insertError } = await supabase.from("trip_members").insert({
        trip_id: tripId,
        user_id: profile.id,
        role: "member",
        status: "accepted",
        display_name: profile.name,
        email: profile.email
    });
    if (insertError && insertError.code !== '23505') {
        alert("Nem sikerült csatlakozni."); return;
    }
    await supabase.from("trip_invites").update({ status: "accepted" }).eq("id", inviteId);
    loadData();
  };

  const handleDeclineInvite = async (inviteId: string) => {
    await supabase.from("trip_invites").delete().eq("id", inviteId);
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;
    setIsDeleting(true);
    try {
        await supabase.from("trips").delete().eq("owner_id", profile.id);
        await supabase.from("trip_members").delete().eq("user_id", profile.id);
        await supabase.auth.signOut();
        router.push("/");
    } catch (err) {
        console.error("Delete error:", err);
        alert("Hiba történt a törlés során.");
        setIsDeleting(false);
    }
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
        
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 transition">
            <Icons.Back /> <span className="ml-1">Vissza a főoldalra</span>
          </Link>
        </div>
        
        {/* PROFIL FEJLÉC */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white p-1 shadow-md mb-4 relative">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name || "User"} className="w-full h-full rounded-full object-cover"/>
            ) : (
              <div className="w-full h-full rounded-full bg-[#16ba53] flex items-center justify-center text-3xl font-bold text-white uppercase">{profile.email.charAt(0)}</div>
            )}
            <div className="absolute bottom-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div className="w-4 h-4 bg-blue-500 rounded-full" title="Google fiók"></div> 
            </div>
          </div>
          
          {/* Név szerkesztése */}
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-1 animate-in fade-in zoom-in">
                <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-xl font-bold text-slate-900 text-center border-b-2 border-[#16ba53] focus:outline-none bg-transparent w-48"
                    autoFocus
                />
                <button onClick={handleUpdateName} disabled={savingName} className="p-1.5 bg-[#16ba53] text-white rounded-full hover:opacity-90">
                    <Icons.Save />
                </button>
                <button onClick={() => setIsEditingName(false)} className="p-1.5 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300">
                    <Icons.X />
                </button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2 group">
                {profile.name || "Névtelen felhasználó"}
                <button onClick={() => setIsEditingName(true)} className="text-slate-300 hover:text-[#16ba53] opacity-0 group-hover:opacity-100 transition">
                    <Icons.Pencil />
                </button>
            </h1>
          )}
          
          <p className="text-sm text-slate-500">{profile.email}</p>
        </div>

        {/* MEGHÍVÁSOK (JAVÍTOTT KIÍRÁSSAL) */}
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
                    {/* MEGHÍVÓ NEVE */}
                    <p className="text-xs text-orange-600 font-bold mb-1">
                        MEGHÍVÓ TŐLE: {invite.inviterName}
                    </p>
                    <h3 className="font-bold text-slate-900 text-lg">{invite.trip.title}</h3>
                    {invite.trip.destination && <p className="text-sm text-slate-500">{invite.trip.destination}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptInvite(invite.id, invite.trip_id)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#16ba53] text-white text-xs font-bold hover:opacity-90 shadow-sm"><Icons.Check /> <span className="ml-1">Elfogadás</span></button>
                    <button onClick={() => handleDeclineInvite(invite.id)} className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"><Icons.X /> <span className="ml-1">Elutasítás</span></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STATISZTIKA */}
        <section className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#16ba53] flex items-center justify-center mb-2"><Icons.Map /></div>
            <span className="text-xl font-bold text-slate-900">{ownedCount}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Saját</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2"><Icons.Users /></div>
            <span className="text-xl font-bold text-slate-900">{sharedCount}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Közös</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-2"><Icons.Clock /></div>
            <span className="text-xl font-bold text-slate-900">{totalDays}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Nap úton</span>
          </div>
        </section>

        {/* FIÓK ADATOK */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
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
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-600 font-bold text-sm py-2 hover:bg-slate-100 rounded-xl transition">
              <Icons.Logout /> Kijelentkezés
            </button>
          </div>
        </section>

        {/* VESZÉLYZÓNA */}
        <section className="border border-red-100 rounded-2xl overflow-hidden bg-red-50/30">
            {!showDeleteConfirm ? (
                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition uppercase tracking-wide"
                >
                    Fiók és adatok törlése
                </button>
            ) : (
                <div className="p-5 text-center">
                    <h3 className="text-sm font-bold text-red-600 mb-2">Biztosan törölni szeretnéd a fiókodat?</h3>
                    <p className="text-xs text-slate-600 mb-4">
                        Ez a művelet végleges. Törli az összes általad létrehozott utazást, fotót és dokumentumot. 
                        A közös utakból kiléptet.
                    </p>
                    <div className="flex gap-2 justify-center">
                        <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50"
                        >
                            Mégse
                        </button>
                        <button 
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-70"
                        >
                            {isDeleting ? "Törlés..." : "Igen, törlöm végleg"}
                        </button>
                    </div>
                </div>
            )}
        </section>

        <p className="text-center text-xs text-slate-300 mt-8">TripLog v1.1</p>
      </div>
    </main>
  );
}