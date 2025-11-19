export type Trip = {
  id: string;
  owner_id: string;
  title: string;
  destination: string | null;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
  drive_folder_id: string | null;
};

export type TripFile = {
  id: string;
  trip_id?: string;
  user_id?: string;
  type: "photo" | "document";
  drive_file_id: string;
  name: string;
  mime_type?: string | null;
  thumbnail_link?: string | null;
  preview_link?: string | null;
};

export type TripExpense = {
  id: string;
  trip_id: string;
  user_id: string | null;
  date: string;
  category: string | null;
  note?: string | null;
  amount: number;
  currency: string | null;
  payment_method: string | null;
  created_at?: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string;
  role: "owner" | "member";
  status: "pending" | "accepted";
  display_name: string | null;
  email: string | null;
};
