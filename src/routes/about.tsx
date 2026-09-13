import { createFileRoute, Link } from "@tanstack/react-router";
import { Coffee, HeartHandshake, Sparkles } from "lucide-react";
import about from "@/assets/about.jpg";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/site/Section";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About NEBA Café — Our Story" },
      {
        name: "description",
        content:
          "NEBA Café brings warm hospitality, fresh food and a modern digital ordering experience together in one place.",
      },
      { property: "og:title", content: "About NEBA Café" },
      { property: "og:description", content: "Warm hospitality, fresh food, modern ordering." },
    ],
  }),
  component: AboutPage,
});

const values = [
  {
    icon: Coffee,
    title: "Food we're proud of",
    text: "Prepared fresh to order, with ingredients we'd serve our own family.",
  },
  {
    icon: HeartHandshake,
    title: "Genuine hospitality",
    text: "Whether you dine in or order ahead, the welcome is the same.",
  },
  {
    icon: Sparkles,
    title: "Modern by design",
    text: "Ordering, payment and tracking are effortless on any device.",
  },
];

function AboutPage() {
  return (
    <>
      <Section>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              About us
            </p>
            <h1 className="mt-3 text-4xl font-semibold md:text-5xl">
              A neighbourhood café, thoughtfully modernised
            </h1>
            <p className="mt-5 text-muted-foreground">
              NEBA Café began with a simple idea: good food should be easy to enjoy. Our kitchen
              focuses on a short, well-made menu — burgers, stone-baked pizza, crisp sides and cold
              drinks — while our digital ordering platform removes the queues and the guesswork.
            </p>
            <p className="mt-4 text-muted-foreground">
              Every dish is prepared to order. Every order is visible to you in real time, from the
              moment it's received to the moment it reaches your table, your hand or your door.
            </p>
            <Button asChild className="mt-7">
              <Link to="/menu">Explore the menu</Link>
            </Button>
          </div>
          <img
            src={about}
            alt="Guests enjoying coffee inside NEBA Café"
            loading="lazy"
            width={1400}
            height={900}
            className="w-full rounded-2xl object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
      </Section>

      <div className="bg-cream">
        <Section>
          <SectionHeading eyebrow="What we stand for" title="Our commitment" align="center" />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="surface-card hover-lift p-6">
                <v.icon className="size-6 text-primary" aria-hidden />
                <h2 className="mt-4 font-display text-lg font-semibold">{v.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{v.text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
