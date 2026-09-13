import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, MapPin, Receipt, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/site/Section";
import { readOrders, type Order } from "@/lib/orders";
import { formatETB } from "@/lib/menu-data";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — NEBA Café" },
      { name: "description", content: "Manage your NEBA Café profile, addresses and order history." },
      { property: "og:title", content: "My Account — NEBA Café" },
      { property: "og:description", content: "Your NEBA Café profile and orders." },
    ],
  }),
  component: AccountPage,
});

const STORAGE_KEY = "neba.profile.v1";

function AccountPage() {
  const [profile, setProfile] = useState<{ name: string; phone: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setOrders(readOrders());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const signIn = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Enter your name and phone number");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setProfile(form);
    toast.success("You're signed in");
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    toast.success("Signed out");
  };

  if (!profile) {
    return (
      <Section className="max-w-md">
        <h1 className="text-4xl font-semibold">Your account</h1>
        <p className="mt-3 text-muted-foreground">
          Demo sign-in. Real accounts, roles and secure sessions are handled by the backend.
        </p>
        <div className="surface-card mt-8 space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Full name</Label>
            <Input
              id="acc-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-phone">Phone number</Label>
            <Input
              id="acc-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
            />
          </div>
          <Button className="w-full" onClick={signIn}>
            Continue
          </Button>
        </div>
      </Section>
    );
  }

  const current = orders.find((o) => o.status !== "completed");

  return (
    <Section className="max-w-3xl">
      <h1 className="text-4xl font-semibold">Hello, {profile.name}</h1>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="surface-card p-6">
          <User className="size-5 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">{profile.name}</p>
          <p className="text-sm text-muted-foreground">{profile.phone}</p>
        </div>

        <div className="surface-card p-6">
          <MapPin className="size-5 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No saved addresses yet — added during delivery checkout.
          </p>
        </div>

        <div className="surface-card p-6 md:col-span-2">
          <Receipt className="size-5 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold">Current order</h2>
          {current ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {current.number} · {formatETB(current.total)}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/order/$id" params={{ id: current.id }}>
                  Track order
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No order in progress.</p>
          )}
          <Button asChild variant="link" className="mt-3 px-0">
            <Link to="/orders">View order history</Link>
          </Button>
        </div>
      </div>

      <Button variant="outline" className="mt-8" onClick={signOut}>
        <LogOut className="size-4" /> Logout
      </Button>
    </Section>
  );
}
