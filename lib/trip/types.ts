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

export type TripFileType = "photo" | "document";

export type TripFile = {
  id: string;
  type: TripFileType;
  name: string;
  drive_file_id: string;
  thumbnail_link: string | null;
  preview_link: string | null;
};

export type TripExpense = {
  id: string;
  trip_id: string;
  user_id: string;
  date: string;
  category: string | null;
  note: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  created_at: string;
};
