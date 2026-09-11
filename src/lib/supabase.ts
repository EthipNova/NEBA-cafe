import { createClient } from "@supabase/supabase-js";

export type UserRole = "ADMIN" | "STAFF";

export type DbUser = {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: DbUser;
        Update: Partial<DbUser>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

const envMeta = import.meta.env;
const envProc = typeof process !== "undefined" ? process.env : undefined;

const supabaseUrl =
  (envMeta["SUPABASE_URL"] as string | undefined) ||
  (envProc ? envProc["SUPABASE_URL"] : undefined) ||
  "";

const supabaseKey =
  (envMeta["SUPABASE_KEY"] as string | undefined) ||
  (envProc ? envProc["SUPABASE_KEY"] : undefined) ||
  "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "NEBA Café: Supabase credentials not found in environment. Ensure SUPABASE_URL and SUPABASE_KEY are set.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
