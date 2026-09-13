import { supabase } from "@/lib/supabase";

export type ThemePreference = "light" | "dark" | "system";

export type NebaSettings = {
  // Café Profile
  cafeName: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  deliveryFee: number;

  // Appearance & Display
  theme: ThemePreference;
  showToasts: boolean;
};

export type StoreSettingsRow = {
  id: number;
  cafe_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_hours: string | null;
  delivery_fee: number | string | null;
  updated_at: string | null;
};

export const SETTINGS_STORAGE_KEY = "neba.settings.v1";

export const DEFAULT_SETTINGS: NebaSettings = {
  cafeName: "NEBA Café",
  phone: "+251 91 123 4567",
  email: "hello@nebacafe.com",
  address: "Bole Medhanialem, Camorra Building, Addis Ababa, Ethiopia",
  openingHours: "Mon – Sun: 7:00 AM – 10:00 PM",
  deliveryFee: 80,
  theme: "light",
  showToasts: true,
};

/**
 * Applies the selected theme class to the document root element.
 * Toggles the `.dark` class defined in styles.css.
 */
export function applyTheme(theme: ThemePreference): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Normalizes a raw Supabase store_settings record and merges with local browser preferences.
 */
export function normalizeStoreSettings(
  row?: Partial<StoreSettingsRow> | null,
  localPrefs?: Partial<NebaSettings>
): NebaSettings {
  const currentLocal = localPrefs || readSettings();

  const parsedFee =
    row?.delivery_fee !== undefined && row?.delivery_fee !== null
      ? Number(row.delivery_fee)
      : undefined;

  return {
    cafeName:
      typeof row?.cafe_name === "string" && row.cafe_name.trim()
        ? row.cafe_name.trim()
        : DEFAULT_SETTINGS.cafeName,
    phone:
      typeof row?.phone === "string" && row.phone.trim()
        ? row.phone.trim()
        : DEFAULT_SETTINGS.phone,
    email:
      typeof row?.email === "string" && row.email.trim()
        ? row.email.trim()
        : DEFAULT_SETTINGS.email,
    address:
      typeof row?.address === "string" && row.address.trim()
        ? row.address.trim()
        : DEFAULT_SETTINGS.address,
    openingHours:
      typeof row?.opening_hours === "string" && row.opening_hours.trim()
        ? row.opening_hours.trim()
        : DEFAULT_SETTINGS.openingHours,
    deliveryFee:
      typeof parsedFee === "number" && !isNaN(parsedFee) && parsedFee >= 0
        ? parsedFee
        : typeof currentLocal.deliveryFee === "number" && !isNaN(currentLocal.deliveryFee)
        ? currentLocal.deliveryFee
        : DEFAULT_SETTINGS.deliveryFee,
    theme: currentLocal.theme || DEFAULT_SETTINGS.theme,
    showToasts:
      typeof currentLocal.showToasts === "boolean"
        ? currentLocal.showToasts
        : DEFAULT_SETTINGS.showToasts,
  };
}

/**
 * Safely reads settings from localStorage with fallback defaults.
 * Crash-proof against null, undefined, or malformed JSON.
 */
export function readSettings(): NebaSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };

    const parsedDeliveryFee =
      typeof parsed.deliveryFee === "number" && !isNaN(parsed.deliveryFee) && parsed.deliveryFee >= 0
        ? parsed.deliveryFee
        : DEFAULT_SETTINGS.deliveryFee;

    return {
      cafeName:
        typeof parsed.cafeName === "string" && parsed.cafeName.trim()
          ? parsed.cafeName.trim()
          : DEFAULT_SETTINGS.cafeName,
      phone:
        typeof parsed.phone === "string" && parsed.phone.trim()
          ? parsed.phone.trim()
          : DEFAULT_SETTINGS.phone,
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email.trim()
          : DEFAULT_SETTINGS.email,
      address:
        typeof parsed.address === "string" && parsed.address.trim()
          ? parsed.address.trim()
          : DEFAULT_SETTINGS.address,
      openingHours:
        typeof parsed.openingHours === "string" && parsed.openingHours.trim()
          ? parsed.openingHours.trim()
          : DEFAULT_SETTINGS.openingHours,
      deliveryFee: parsedDeliveryFee,
      theme:
        parsed.theme === "dark" || parsed.theme === "light" || parsed.theme === "system"
          ? parsed.theme
          : DEFAULT_SETTINGS.theme,
      showToasts:
        typeof parsed.showToasts === "boolean" ? parsed.showToasts : DEFAULT_SETTINGS.showToasts,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Writes browser workspace preferences to localStorage and applies the theme to the DOM.
 */
export function writeSettings(settings: NebaSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
  } catch {
    // Ignore storage quota or disabled localStorage errors
  }
}

/**
 * Resets settings back to original defaults.
 * Does NOT touch or delete orders, promotions, or roles.
 */
export function resetSettings(): NebaSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    applyTheme(DEFAULT_SETTINGS.theme);
  } catch {
    // ignore
  }

  return { ...DEFAULT_SETTINGS };
}

/**
 * Fetches the singleton store settings row (id = 1) from Supabase public.store_settings.
 * If no record exists yet, returns default settings without inserting anything.
 * Merges with local browser preferences (theme, showToasts).
 */
export async function fetchStoreSettings(): Promise<{
  data: NebaSettings | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase.from("store_settings" as any) as any)
      .select("id, cafe_name, phone, email, address, opening_hours, delivery_fee, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const localPrefs = readSettings();
    const settings = normalizeStoreSettings(data, localPrefs);
    return { data: settings, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to load store settings"),
    };
  }
}

/**
 * Upserts the singleton store settings row (id = 1) in Supabase public.store_settings.
 * Persists business fields to the database and saves browser preferences locally.
 */
export async function updateStoreSettings(
  settings: NebaSettings
): Promise<{
  data: NebaSettings | null;
  error: Error | null;
}> {
  try {
    const deliveryFeeNum = Number(settings.deliveryFee);
    const safeDeliveryFee = isNaN(deliveryFeeNum) || deliveryFeeNum < 0 ? 0 : deliveryFeeNum;

    const payload = {
      id: 1,
      cafe_name: settings.cafeName.trim() || DEFAULT_SETTINGS.cafeName,
      phone: settings.phone.trim() || DEFAULT_SETTINGS.phone,
      email: settings.email.trim() || DEFAULT_SETTINGS.email,
      address: settings.address.trim() || DEFAULT_SETTINGS.address,
      opening_hours: settings.openingHours.trim() || DEFAULT_SETTINGS.openingHours,
      delivery_fee: safeDeliveryFee,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from("store_settings" as any) as any)
      .upsert(payload, { onConflict: "id" })
      .select("id, cafe_name, phone, email, address, opening_hours, delivery_fee, updated_at")
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Save browser workspace preferences locally
    writeSettings(settings);

    const updated = normalizeStoreSettings(data, {
      theme: settings.theme,
      showToasts: settings.showToasts,
    });

    return { data: updated, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to update store settings"),
    };
  }
}
