import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/site/Section";
import { DEFAULT_SETTINGS, type NebaSettings } from "@/lib/settings";
import { fetchSettings } from "@/services/api";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    try {
      const settings = await fetchSettings();
      return { settings };
    } catch {
      return { settings: DEFAULT_SETTINGS };
    }
  },
  head: () => ({
    meta: [
      { title: "Contact NEBA Café" },
      {
        name: "description",
        content: "Get in touch with NEBA Café — location, phone, email, opening hours and enquiries.",
      },
      { property: "og:title", content: "Contact NEBA Café" },
      { property: "og:description", content: "Location, hours and how to reach NEBA Café." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const loaderData = Route.useLoaderData();
  const [sent, setSent] = useState(false);
  const [settings, setSettings] = useState<NebaSettings>(loaderData?.settings || DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const remote = await fetchSettings();
        if (!cancelled && remote) {
          setSettings(remote);
        }
      } catch (err) {
        console.warn("Failed to load contact settings:", err);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const details = [
    { icon: MapPin, label: "Location", value: settings.address || DEFAULT_SETTINGS.address },
    { icon: Phone, label: "Phone", value: settings.phone || DEFAULT_SETTINGS.phone },
    { icon: Mail, label: "Email", value: settings.email || DEFAULT_SETTINGS.email },
    { icon: Clock, label: "Opening hours", value: settings.openingHours || DEFAULT_SETTINGS.openingHours },
  ];

  return (
    <Section>
      <h1 className="text-4xl font-semibold">Contact us</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Questions about an order, a booking or catering? Send us a message.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <ul className="grid gap-4 sm:grid-cols-2">
            {details.map((d) => (
              <li key={d.label} className="surface-card p-5">
                <d.icon className="size-5 text-primary" aria-hidden />
                <h2 className="mt-3 font-display text-base font-semibold">{d.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{d.value}</p>
              </li>
            ))}
          </ul>
          <div className="surface-card flex h-56 items-center justify-center bg-muted text-sm text-muted-foreground">
            Map integration: {settings.address}
          </div>
          <p className="text-sm text-muted-foreground">
            Social media: @nebacafe
          </p>
        </div>

        <form
          className="surface-card space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
            toast.success("Message sent — we'll be in touch");
          }}
        >
          <h2 className="font-display text-xl font-semibold">Send a message</h2>
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-message">Message</Label>
            <Textarea id="c-message" rows={5} required />
          </div>
          <Button type="submit" className="w-full">
            Send message
          </Button>
          {sent && (
            <p role="status" className="text-sm text-success">
              Thanks — your message has been recorded.
            </p>
          )}
        </form>
      </div>
    </Section>
  );
}
