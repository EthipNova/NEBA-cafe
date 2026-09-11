import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  AlertCircle,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Tag,
  ToggleLeft,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyTheme, readSettings } from "@/lib/settings";
import { supabase, type UserRole } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — NEBA Café" },
      {
        name: "description",
        content:
          "Operations, catalog, availability, payments and settings for NEBA Café management.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, exact: false },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, exact: false },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, exact: false },
  { to: "/admin/availability", label: "Availability", icon: ToggleLeft, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

async function verifyUserRole(userId: string): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    if (data.role === "ADMIN" || data.role === "STAFF") {
      return data.role;
    }

    return null;
  } catch {
    return null;
  }
}

function AdminLayout() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(readSettings().theme);

    let isMounted = true;

    // Check existing active Supabase session on initial load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      if (session?.user) {
        const verifiedRole = await verifyUserRole(session.user.id);
        if (!isMounted) return;

        if (verifiedRole) {
          setRole(verifiedRole);
        } else {
          // User is authenticated in Supabase Auth but has no valid role in public.users
          await supabase.auth.signOut();
          setRole(null);
          setErrorMsg(
            "Your account has been authenticated, but it has not been assigned an authorized NEBA staff role. Please contact the administrator.",
          );
        }
      }

      if (isMounted) {
        setReady(true);
      }
    });

    // Listen for session changes (sign in, sign out, token refresh, expiration)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setRole(null);
        setReady(true);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const verifiedRole = await verifyUserRole(session.user.id);
        if (!isMounted) return;

        if (verifiedRole) {
          setRole(verifiedRole);
          setErrorMsg(null);
        } else {
          await supabase.auth.signOut();
          setRole(null);
          setErrorMsg(
            "Your account has been authenticated, but it has not been assigned an authorized NEBA staff role. Please contact the administrator.",
          );
        }
        setReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setErrorMsg("Invalid email or password.");
        } else {
          setErrorMsg(error.message || "Failed to sign in.");
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        const verifiedRole = await verifyUserRole(data.user.id);
        if (!verifiedRole) {
          await supabase.auth.signOut();
          setErrorMsg(
            "Your account has been authenticated, but it has not been assigned an authorized NEBA staff role. Please contact the administrator.",
          );
          setLoading(false);
          return;
        }

        setRole(verifiedRole);
        setErrorMsg(null);
        toast.success(`Signed in as ${verifiedRole}`);
      }
    } catch {
      setErrorMsg("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setRole(null);
      setPassword("");
      setErrorMsg(null);
      toast.success("Signed out successfully");
    } catch {
      toast.error("Error signing out");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <p className="p-10 text-sm text-muted-foreground animate-pulse">Verifying credentials…</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="surface-card w-full max-w-sm p-8">
          <h1 className="font-display text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your NEBA staff credentials to access café operations.
          </p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            {errorMsg && (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@nebacafe.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <Button asChild variant="link" className="mt-4 w-full">
            <Link to="/">Back to café site</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Link to="/" className="px-2 py-3">
          <span className="font-display text-lg font-semibold">NEBA</span>
          <span className="ml-2 text-[10px] uppercase tracking-[0.2em] opacity-70">Console</span>
        </Link>
        <nav className="mt-4 flex-1 space-y-1" aria-label="Admin navigation">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm opacity-90 transition-colors hover:bg-sidebar-accent"
            >
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="px-3 text-xs opacity-60">Signed in as {role}</p>
          <Button
            variant="ghost"
            disabled={loading}
            className="mt-1 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleSignOut}
          >
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex gap-2 overflow-x-auto bg-sidebar p-2 text-sidebar-foreground md:hidden">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-sidebar-accent" }}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm"
            >
              {n.label}
            </Link>
          ))}
        </div>
        <div className="p-4 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
