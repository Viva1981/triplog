export type Trip = {
  id: string;
  owner_id: string;
  title: string;
  destination: string | null;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
  drive_folder_id: string | null;
  created_at?: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string;
  role: "owner" | "member";
  status: "pending" | "accepted" | "rejected";
  email?: string;
  display_name?: string;
};

export type TripFile = {
  id: string;
  trip_id: string;
  user_id: string;
  type: "photo" | "document";
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  thumbnail_link: string | null;
  preview_link: string | null; // Ezt használjuk a képekhez és doksikhoz is
  created_at?: string;
};

export type TripExpense = {
  id: string;
  trip_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  currency: string;
  payment_method: string;
  note: string | null;
  created_at?: string;
};

// --- ÚJ RÉSZ: TRIP ACTIVITY (TERV) ---
export type ActivityType = "accommodation" | "travel" | "food" | "program" | "other";

export type TripActivity = {
  id: string;
  trip_id: string;
  created_by: string;
  type: ActivityType;
  title: string;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  start_time: string | null; // ISO timestamp
  end_time: string | null;   // ISO timestamp
  status: "planned" | "booked" | "done";
  notes: string | null;
  created_at?: string;
};