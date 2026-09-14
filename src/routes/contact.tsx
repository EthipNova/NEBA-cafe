import { createFileRoute } from "@tanstack/react-router";
import { Clock, ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
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
        content:
          "Get in touch with NEBA Café — location, phone, email, opening hours and enquiries.",
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
    {
      icon: Clock,
      label: "Opening hours",
      value: settings.openingHours || DEFAULT_SETTINGS.openingHours,
    },
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
          <div className="surface-card relative overflow-hidden p-6 sm:p-7">
            {/* Subtle decorative coordinate grid background */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.10]"
              aria-hidden
            >
              <svg
                className="h-full w-full"
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                height="100%"
              >
                <defs>
                  <pattern
                    id="contact-map-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 24 0 L 0 0 0 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#contact-map-grid)" />
              </svg>
            </div>

            {/* Subtle ambient brand glow */}
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-primary/10 blur-2xl"
              aria-hidden
            />

            <div className="relative z-10 flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <MapPin className="size-3.5" aria-hidden />
                    Our Location
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Piassa • Near Kibru Hospital
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Visit NEBA Café
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {settings.address || DEFAULT_SETTINGS.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center pt-1">
                <Button asChild className="gap-2">
                  <a
                    href="https://maps.app.goo.gl/JSWYJbLG9sL3gfK5A"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View NEBA Café on Google Maps"
                  >
                    <Navigation className="size-4" aria-hidden />
                    View on Google Maps
                    <ExternalLink className="size-3.5 opacity-80" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Social media: @nebacafe</p>
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
