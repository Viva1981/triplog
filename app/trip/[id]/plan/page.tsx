"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import type { Trip, TripActivity, ActivityType } from "../../../../lib/trip/types";
import DestinationAutocomplete from "../../../new-trip/DestinationAutocomplete";

// --- SVG IKONOK (Emoji helyett) ---
const PlanIcons = {
  Back: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Bucket: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Clock: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  MapPin: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  
  // Típus ikonok
  TypeProgram: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" /></svg>, // Múzeum/Hely
  TypeFood: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>,
  TypeTravel: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  TypeAccommodation: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  TypeOther: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
};

// Segédfüggvény: dátumok generálása
function getDatesInRange(startDate: string, endDate: string) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ha rossz a dátum, csak a startot adjuk vissza
  if(isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current).toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Formázás: 2025-10-23 -> Okt 23.
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

// Formázás: 14:00
function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
}

export default function TripPlanPage() {
  const params = useParams();
  const router = useRouter();
  
  // State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<TripActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // View State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"days" | "bucket">("days");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newType, setNewType] = useState<ActivityType>("program");
  const [newStartTime, setNewStartTime] = useState(""); // HH:mm formátum, ha napi nézetben vagyunk
  const [submitting, setSubmitting] = useState(false);

  // 1. Adatok betöltése
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!params?.id) return;

      // Trip lekérése
      const { data: tripData } = await supabase.from("trips").select("*").eq("id", params.id).single();
      if (!tripData) {
        router.push("/");
        return;
      }
      setTrip(tripData as Trip);

      // Kezdő dátum beállítása
      if (tripData.date_from) {
        setSelectedDate(tripData.date_from.split('T')[0]);
        setViewMode("days");
      } else {
        setViewMode("bucket");
      }

      // Programok lekérése
      fetchActivities(tripData.id);
      setLoading(false);
    };

    init();
  }, [params, router]);

  const fetchActivities = async (tripId: string) => {
    const { data } = await supabase
      .from("trip_activities")
      .select("*")
      .eq("trip_id", tripId)
      .order("start_time", { ascending: true }); // Időrendben
    
    if (data) setActivities(data as TripActivity[]);
  };

  // 2. Számított értékek
  const tripDates = useMemo(() => {
    if (!trip?.date_from || !trip?.date_to) return [];
    return getDatesInRange(trip.date_from, trip.date_to);
  }, [trip]);

  // Szűrt lista az aktuális nézethez
  const currentActivities = useMemo(() => {
    if (viewMode === "bucket") {
      return activities.filter(a => !a.start_time);
    }
    if (selectedDate) {
      return activities.filter(a => a.start_time && a.start_time.startsWith(selectedDate));
    }
    return [];
  }, [activities, viewMode, selectedDate]);

  // 3. Új program mentése
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip || !user) return;
    
    setSubmitting(true);

    // Dátum összeállítása
    let finalStartTime: string | null = null;
    
    if (viewMode === "days" && selectedDate) {
      // Ha napi nézetben vagyunk, akkor a kiválasztott nap + megadott idő (vagy 08:00 default)
      const time = newStartTime || "08:00";
      finalStartTime = `${selectedDate}T${time}:00`; 
    }
    // Ha bucket list, akkor null marad

    const { error } = await supabase.from("trip_activities").insert({
      trip_id: trip.id,
      created_by: user.id,
      title: newTitle,
      location_name: newLocation,
      type: newType,
      start_time: finalStartTime,
      status: "planned"
    });

    if (!error) {
      await fetchActivities(trip.id);
      setIsModalOpen(false);
      setNewTitle("");
      setNewLocation("");
      setNewStartTime("");
    }
    setSubmitting(false);
  };

  // Típus választó komponens
  const TypeSelector = ({ selected, onSelect }: { selected: ActivityType, onSelect: (t: ActivityType) => void }) => {
    const types: { id: ActivityType, label: string, icon: any }[] = [
      { id: "program", label: "Program", icon: PlanIcons.TypeProgram },
      { id: "food", label: "Étel", icon: PlanIcons.TypeFood },
      { id: "travel", label: "Utazás", icon: PlanIcons.TypeTravel },
      { id: "accommodation", label: "Szállás", icon: PlanIcons.TypeAccommodation },
      { id: "other", label: "Egyéb", icon: PlanIcons.TypeOther },
    ];

    return (
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {types.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border min-w-[70px] transition-all ${
              selected === t.id 
                ? "border-[#16ba53] bg-emerald-50 text-[#16ba53]" 
                : "border-slate-100 bg-white text-slate-400 hover:bg-slate-50"
            }`}
          >
            <t.icon />
            <span className="text-[10px] font-medium mt-1">{t.label}</span>
          </button>
        ))}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400 text-sm">Terv betöltése...</p></div>;
  if (!trip) return null;

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* HEADER */}
        <div className="mb-6">
          <Link href={`/trip/${trip.id}`} className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 mb-2 transition">
            <PlanIcons.Back /> <span className="ml-1">Vissza</span>
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">TripTerv</h1>
            <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-100">
              <button 
                onClick={() => setViewMode("days")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "days" ? "bg-[#16ba53] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                Napi bontás
              </button>
              <button 
                onClick={() => setViewMode("bucket")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${viewMode === "bucket" ? "bg-[#16ba53] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <PlanIcons.Bucket /> Bakancslista
              </button>
            </div>
          </div>
        </div>

        {/* NAPI VÁLASZTÓ (Csak ha van dátum) */}
        {viewMode === "days" && tripDates.length > 0 && (
          <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide -mx-4 px-4">
            {tripDates.map(date => {
              const isActive = selectedDate === date;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center min-w-[70px] p-2 rounded-xl border transition ${
                    isActive 
                      ? "border-[#16ba53] bg-white shadow-md ring-1 ring-[#16ba53]/20" 
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${isActive ? "text-[#16ba53]" : "text-slate-400"}`}>
                    {new Date(date).toLocaleDateString("hu-HU", { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span className={`text-lg font-bold ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                    {new Date(date).getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* IDŐVONAL NÉZET */}
        <div className="space-y-4">
          {currentActivities.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="inline-block p-3 rounded-full bg-slate-50 text-slate-300 mb-2">
                <PlanIcons.Calendar />
              </div>
              <p className="text-sm text-slate-500 font-medium">Még nincs program erre a napra</p>
              <p className="text-xs text-slate-400">Tervezz valami izgalmasat!</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-4">
              {currentActivities.map((activity, idx) => {
                // Ikon kiválasztása típus szerint
                const TypeIcon = 
                  activity.type === 'food' ? PlanIcons.TypeFood :
                  activity.type === 'travel' ? PlanIcons.TypeTravel :
                  activity.type === 'accommodation' ? PlanIcons.TypeAccommodation :
                  activity.type === 'other' ? PlanIcons.TypeOther : 
                  PlanIcons.TypeProgram;

                return (
                  <div key={activity.id} className="relative pl-6">
                    {/* Pötty a vonalon */}
                    <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 border-white bg-[#16ba53] shadow-sm"></div>
                    
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Időpont (ha van) */}
                          {activity.start_time && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#16ba53] mb-1">
                              <PlanIcons.Clock />
                              {formatTime(activity.start_time)}
                            </div>
                          )}
                          
                          <h3 className="text-base font-bold text-slate-800 mb-1">{activity.title}</h3>
                          
                          {activity.location_name && (
                            <div className="flex items-start gap-1 text-xs text-slate-500">
                              <div className="mt-0.5"><PlanIcons.MapPin /></div>
                              <span>{activity.location_name}</span>
                            </div>
                          )}
                        </div>

                        {/* Típus ikon jobb oldalt */}
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-[#16ba53] group-hover:bg-emerald-50 transition">
                          <TypeIcon />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ÚJ PROGRAM GOMB (FAB) */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 bg-[#16ba53] text-white p-4 rounded-full shadow-lg hover:bg-[#139a45] active:scale-95 transition-all z-20 flex items-center gap-2 pr-6"
        >
          <PlanIcons.Plus />
          <span className="font-bold text-sm">Új program</span>
        </button>

        {/* MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-10">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Új program hozzáadása</h2>
              
              <form onSubmit={handleAddActivity} className="space-y-4">
                
                {/* Típus választó */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Típus</label>
                  <TypeSelector selected={newType} onSelect={setNewType} />
                </div>

                {/* Cím */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Megnevezés</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Pl.: Vacsora a parton"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                  />
                </div>

                {/* Helyszín */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Helyszín</label>
                  <DestinationAutocomplete 
                    value={newLocation} 
                    onChange={setNewLocation} 
                  />
                </div>

                {/* Időpont (Csak napi nézetben) */}
                {viewMode === "days" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kezdés ideje</label>
                    <input 
                      type="time" 
                      value={newStartTime}
                      onChange={e => setNewStartTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16ba53]"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                  >
                    Mégse
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#16ba53] text-white text-sm font-bold hover:opacity-90 disabled:opacity-70"
                  >
                    {submitting ? "Mentés..." : "Hozzáadás"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}