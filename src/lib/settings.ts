export type ThemePreference = "light" | "dark" | "system";

export type NebaSettings = {
  // Café Profile
  cafeName: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;

  // Appearance & Display
  theme: ThemePreference;
  showToasts: boolean;
};

export const SETTINGS_STORAGE_KEY = "neba.settings.v1";

export const DEFAULT_SETTINGS: NebaSettings = {
  cafeName: "NEBA Café",
  phone: "+251 91 123 4567",
  email: "hello@nebacafe.com",
  address: "Bole Medhanialem, Camorra Building, Addis Ababa, Ethiopia",
  openingHours: "Mon – Sun: 7:00 AM – 10:00 PM",
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
 * Writes settings to localStorage and applies the theme to the DOM.
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
