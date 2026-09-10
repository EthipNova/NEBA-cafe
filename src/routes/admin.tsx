import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  ClipboardList,
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

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff & Admin — NEBA Café" },
      {
        name: "description",
        content: "Order operations, products and availability for NEBA Café staff.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const ROLE_KEY = "neba.role.v1";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList, exact: false },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, exact: false },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, exact: false },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, exact: false },
  { to: "/admin/availability", label: "Availability", icon: ToggleLeft, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

const disabledNav: { label: string; icon: typeof Settings }[] = [];

function AdminLayout() {
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem(ROLE_KEY));
    applyTheme(readSettings().theme);
    setReady(true);
  }, []);

  if (!ready) {
    return <p className="p-10 text-muted-foreground">Loading dashboard…</p>;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="surface-card w-full max-w-sm p-8">
          <h1 className="font-display text-2xl font-semibold">Staff sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Demo access only. Real sessions and role checks are enforced by the backend.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="staff-email">Work email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nebacafe.example"
            />
          </div>
          <div className="mt-6 grid gap-2">
            {["STAFF", "ADMIN"].map((r) => (
              <Button
                key={r}
                variant={r === "ADMIN" ? "default" : "outline"}
                onClick={() => {
                  localStorage.setItem(ROLE_KEY, r);
                  setRole(r);
                  toast.success(`Signed in as ${r.toLowerCase()}`);
                }}
              >
                Continue as {r.toLowerCase()}
              </Button>
            ))}
          </div>
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
          {disabledNav.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-5 text-[10px] uppercase tracking-[0.2em] opacity-50">
                Coming next
              </p>
              {disabledNav.map((n) => (
                <span
                  key={n.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm opacity-40"
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </span>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="px-3 text-xs opacity-60">Signed in as {role}</p>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => {
              localStorage.removeItem(ROLE_KEY);
              setRole(null);
            }}
          >
            <LogOut className="size-4" /> Sign out
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
