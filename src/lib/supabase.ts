import { createClient } from "@supabase/supabase-js";

export type UserRole = "ADMIN" | "STAFF";

export type DbUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
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
  (envMeta["VITE_SUPABASE_URL"] as string | undefined) ||
  (envProc ? envProc["SUPABASE_URL"] : undefined) ||
  "";

const supabaseKey =
  (envMeta["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  (envProc ? envProc["SUPABASE_KEY"] : undefined) ||
  "";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "NEBA Café: Supabase credentials not found in environment. Ensure SUPABASE_URL and SUPABASE_KEY are set.",
  );
}

// Clean up any legacy Supabase Auth tokens lingering in localStorage from previous configuration
if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage access restrictions */
  }
}

export { supabaseUrl, supabaseKey };

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage:
      typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
        ? window.sessionStorage
        : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Creates a request-scoped Supabase client that forwards an authenticated user's bearer token
 * to PostgREST so that Row-Level Security (RLS) policies evaluate auth.uid() correctly.
 */
export function createScopedClient(token: string) {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
