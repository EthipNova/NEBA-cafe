import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Info,
  Laptop,
  Mail,
  MapPin,
  Moon,
  Palette,
  Phone,
  RotateCcw,
  Save,
  Server,
  ShoppingBag,
  Store,
  Sun,
  Truck,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  applyTheme,
  DEFAULT_SETTINGS,
  readSettings,
  resetSettings,
  SETTINGS_STORAGE_KEY,
  writeSettings,
  type NebaSettings,
  type ThemePreference,
} from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — NEBA Café" },
      {
        name: "description",
        content:
          "Configure café profile information, appearance preferences, and system parameters.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const [savedSettings, setSavedSettings] = useState<NebaSettings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState<NebaSettings>(DEFAULT_SETTINGS);
  const [role, setRole] = useState<string | null>(null);

  // Load settings on client mount and synchronize with cross-tab storage changes
  useEffect(() => {
    const loaded = readSettings();
    setSavedSettings(loaded);
    setForm(loaded);
    setRole(localStorage.getItem("neba.role.v1"));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY || e.key === null) {
        const next = readSettings();
        setSavedSettings(next);
        setForm(next);
      }
      if (e.key === "neba.role.v1") {
        setRole(localStorage.getItem("neba.role.v1"));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Dirty state tracking to prevent accidental saves or confusion
  const isDirty =
    form.cafeName !== savedSettings.cafeName ||
    form.phone !== savedSettings.phone ||
    form.email !== savedSettings.email ||
    form.address !== savedSettings.address ||
    form.openingHours !== savedSettings.openingHours ||
    form.theme !== savedSettings.theme ||
    form.showToasts !== savedSettings.showToasts;

  const handleFieldChange = <K extends keyof NebaSettings>(key: K, value: NebaSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    setForm((prev) => ({ ...prev, theme: newTheme }));
    // Immediately apply theme to the DOM so user experiences visual feedback
    applyTheme(newTheme);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    writeSettings(form);
    setSavedSettings(form);
    if (form.showToasts) {
      toast.success("Settings saved successfully", {
        description: "Your changes have been saved to local storage.",
      });
    }
  };

  const handleCancel = () => {
    setForm(savedSettings);
    applyTheme(savedSettings.theme);
    if (savedSettings.showToasts) {
      toast.info("Unsaved changes discarded");
    }
  };

  const handleRestoreDefaults = () => {
    const reset = resetSettings();
    setSavedSettings(reset);
    setForm(reset);
    if (reset.showToasts) {
      toast.success("Settings restored to defaults", {
        description: "All preferences have been reset to factory defaults.",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 1. HEADER & DEMO NOTICE */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage café business details, appearance preferences, and review operational defaults.
            </p>
          </div>
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-1.5">
                <Save className="size-4" aria-hidden />
                Save changes
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
            Frontend Settings
          </Badge>
          <span>
            Preferences are currently stored locally in this browser under{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono text-foreground">
              {SETTINGS_STORAGE_KEY}
            </code>
            . Central server synchronization will connect when the NEBA backend is deployed.
          </span>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 2. SECTION: CAFÉ PROFILE & CONTACT */}
        <section aria-labelledby="cafe-profile-heading" className="surface-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Store className="size-5 text-primary" aria-hidden />
                <h2 id="cafe-profile-heading" className="font-display text-xl font-semibold">
                  Café Profile & Contact
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Public café contact details displayed across the website and order receipts.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Client Profile
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Café Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="setting-cafe-name">Café Name</Label>
              <div className="relative">
                <Store
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="setting-cafe-name"
                  value={form.cafeName}
                  onChange={(e) => handleFieldChange("cafeName", e.target.value)}
                  placeholder="e.g. NEBA Café"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="setting-phone">Customer Phone Number</Label>
              <div className="relative">
                <Phone
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="setting-phone"
                  value={form.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder="e.g. +251 91 123 4567"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="setting-email">Enquiries Email</Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="setting-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="e.g. hello@nebacafe.com"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="setting-address">Physical Location / Address</Label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="setting-address"
                  value={form.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  placeholder="e.g. Bole Medhanialem, Camorra Building, Addis Ababa, Ethiopia"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>

            {/* Opening Hours */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="setting-hours">Service & Opening Hours</Label>
              <div className="relative">
                <Clock
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="setting-hours"
                  value={form.openingHours}
                  onChange={(e) => handleFieldChange("openingHours", e.target.value)}
                  placeholder="e.g. Mon – Sun: 7:00 AM – 10:00 PM"
                  className="pl-9 h-9 text-sm"
                  required
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. SECTION: APPEARANCE & DISPLAY */}
        <section aria-labelledby="appearance-heading" className="surface-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Palette className="size-5 text-primary" aria-hidden />
                <h2 id="appearance-heading" className="font-display text-xl font-semibold">
                  Appearance & Display
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Customize the visual interface and operational alert behavior for this browser.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Live Effect
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Workspace Theme</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Select your preferred color theme. Changes take effect immediately.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Light Theme */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    form.theme === "light"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-border/80 bg-card/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Sun className="size-5 text-amber-600" aria-hidden />
                    {form.theme === "light" && (
                      <Check className="size-4 text-primary" aria-hidden />
                    )}
                  </div>
                  <span className="font-medium text-sm mt-3 text-foreground">NEBA Light</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Clean white and charcoal daylight palette with NEBA red accents.
                  </span>
                </button>

                {/* Dark Theme */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    form.theme === "dark"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-border/80 bg-card/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Moon className="size-5 text-primary" aria-hidden />
                    {form.theme === "dark" && <Check className="size-4 text-primary" aria-hidden />}
                  </div>
                  <span className="font-medium text-sm mt-3 text-foreground">Charcoal Dark</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Deep charcoal background with bold NEBA red accents.
                  </span>
                </button>

                {/* System Theme */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("system")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    form.theme === "system"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-border/80 bg-card/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Laptop className="size-5 text-muted-foreground" aria-hidden />
                    {form.theme === "system" && (
                      <Check className="size-4 text-primary" aria-hidden />
                    )}
                  </div>
                  <span className="font-medium text-sm mt-3 text-foreground">System Default</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Automatically matches your operating system preference.
                  </span>
                </button>
              </div>
            </div>

            {/* Notification / Toast alert toggle */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <div className="space-y-0.5">
                <Label htmlFor="setting-show-toasts" className="text-sm font-medium">
                  In-App Toast Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Display interactive confirmation toasts when updating orders, promotions, or
                  settings.
                </p>
              </div>
              <Switch
                id="setting-show-toasts"
                checked={form.showToasts}
                onCheckedChange={(checked) => handleFieldChange("showToasts", checked)}
                aria-label="Toggle in-app toast alerts"
              />
            </div>
          </div>
        </section>

        {/* 4. SECTION: ORDERING CHANNELS & PRICING RULES (INFORMATIONAL / BACKEND-AUTHORITATIVE) */}
        <section aria-labelledby="ordering-rules-heading" className="surface-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" aria-hidden />
                <h2 id="ordering-rules-heading" className="font-display text-xl font-semibold">
                  Ordering Channels & Pricing Rules
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active fulfillment channels and standard pricing parameters enforced by the client
                ordering pipeline.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Backend Authoritative
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Delivery Fee */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Delivery Fee
                </span>
                <Truck className="size-4 text-primary" aria-hidden />
              </div>
              <p className="font-display text-2xl font-bold text-foreground">80 ETB</p>
              <p className="text-[11px] text-muted-foreground">
                Standard flat rate applied at checkout
              </p>
            </div>

            {/* Active Channels */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Fulfillment
                </span>
                <Utensils className="size-4 text-primary" aria-hidden />
              </div>
              <p className="font-display text-lg font-bold text-foreground">3 Channels</p>
              <p className="text-[11px] text-muted-foreground">
                Dine-in, Takeaway, and Delivery enabled
              </p>
            </div>

            {/* Currency */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Currency
                </span>
                <Globe className="size-4 text-primary" aria-hidden />
              </div>
              <p className="font-display text-2xl font-bold text-foreground">ETB</p>
              <p className="text-[11px] text-muted-foreground">
                Ethiopian Birr with formatted separators
              </p>
            </div>

            {/* Order Sequence */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Order IDs
                </span>
                <CheckCircle2 className="size-4 text-success" aria-hidden />
              </div>
              <p className="font-display text-lg font-bold text-foreground">#1000 – #1999</p>
              <p className="text-[11px] text-muted-foreground">Sequential client allocation</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden />
            <span>
              <strong>Note on pricing authority:</strong> Delivery fees, channel availability, and
              tax/service rates are currently defined in frontend constants. Dynamic distance
              calculations, kitchen order throttling, and automated promotions engine will be
              managed server-side upon backend integration.
            </span>
          </div>
        </section>

        {/* 5. SECTION: SYSTEM & ENVIRONMENT INFORMATION (READ-ONLY) */}
        <section aria-labelledby="system-info-heading" className="surface-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-5 text-primary" aria-hidden />
                <h2 id="system-info-heading" className="font-display text-xl font-semibold">
                  System & Environment
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Technical metadata about the current client deployment and local storage partitions.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Read-Only
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="text-xs text-muted-foreground">Application</span>
              <span className="font-medium text-foreground text-xs">NEBA Café Ordering System</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="text-xs text-muted-foreground">Runtime Mode</span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                {import.meta.env.MODE || "development"}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="text-xs text-muted-foreground">Active Role</span>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {role || "ADMIN"}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="text-xs text-muted-foreground">Storage Engine</span>
              <span className="text-xs font-medium text-foreground">Browser LocalStorage</span>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-border/60 bg-card/40 p-3 space-y-1.5">
              <span className="text-xs text-muted-foreground block font-medium">
                Active Client Storage Partitions
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  <Database className="size-3" aria-hidden /> neba.orders.v1
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  <Database className="size-3" aria-hidden /> neba.promotions.v1
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  <Database className="size-3" aria-hidden /> neba.settings.v1
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  <Database className="size-3" aria-hidden /> neba.role.v1
                </span>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <span className="text-xs text-muted-foreground">Backend Status</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Not Connected (Independent Frontend Demonstration)
              </span>
            </div>
          </div>
        </section>

        {/* ACTION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={!isDirty}
              className="gap-2"
              aria-label="Save all settings changes"
            >
              <Save className="size-4" aria-hidden />
              <span>Save Settings</span>
            </Button>

            {isDirty && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                aria-label="Discard unsaved changes"
              >
                Discard Changes
              </Button>
            )}
          </div>

          <span className="text-xs text-muted-foreground">
            {isDirty ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ● You have unsaved changes
              </span>
            ) : (
              <span className="text-muted-foreground">All settings are up to date</span>
            )}
          </span>
        </div>
      </form>

      {/* 6. SECTION: RESET DEFAULTS (DANGER ZONE) */}
      <section
        aria-labelledby="reset-defaults-heading"
        className="surface-card p-6 space-y-4 border-destructive/25"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="size-5 text-destructive" aria-hidden />
              <h2 id="reset-defaults-heading" className="font-display text-lg font-semibold">
                Restore Default Settings
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Reset all café profile information, theme selections, and local workspace preferences
              back to factory defaults.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Restore Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-5" aria-hidden />
                  Restore default settings?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <span>
                    This action will reset your café profile details, theme preferences, and in-app
                    display options to their factory defaults.
                  </span>
                  <span className="block font-medium text-foreground">
                    Your saved customer orders (<code>neba.orders.v1</code>) and promotional
                    campaigns (<code>neba.promotions.v1</code>) will remain completely safe and
                    untouched.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRestoreDefaults}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Restore Defaults
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Restoring defaults only clears the <code>neba.settings.v1</code> partition. It does not
            modify or remove existing orders or inventory.
          </span>
        </div>
      </section>
    </div>
  );
}
