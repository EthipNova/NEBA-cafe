import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CreditCard,
  Leaf,
  MapPin,
  Package,
  Radar,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeading } from "@/components/site/Section";
import { ProductCard } from "@/components/site/ProductCard";
import {
  categories as seedCategories,
  formatETB,
  getProduct,
  products as seedProducts,
  promotion,
  registerProducts,
  type Category,
  type Product,
} from "@/lib/menu-data";
import type { Promotion } from "@/lib/promotions";
import { fetchCategories, fetchProducts, fetchPromotions } from "@/services/api";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [categories, products, promotions] = await Promise.all([
      fetchCategories().catch(() => seedCategories),
      fetchProducts().catch(() => seedProducts),
      fetchPromotions().catch(() => []),
    ]);
    return { categories, products, promotions };
  },
  head: () => ({
    meta: [
      { title: "NEBA Café — Good Food. Great Moments. Simply NEBA." },
      {
        name: "description",
        content:
          "Order burgers, pizza, sides and drinks from NEBA Café. Browse the menu, pay securely and track your order in real time.",
      },
      { property: "og:title", content: "NEBA Café — Good Food. Great Moments." },
      {
        property: "og:description",
        content: "A modern café ordering experience, powered by ORNIX-TECH.",
      },
    ],
  }),
  component: Home,
});

const benefits = [
  {
    icon: ShoppingBag,
    title: "Easy Ordering",
    text: "Browse and order without unnecessary steps.",
  },
  { icon: Leaf, title: "Fresh Menu", text: "See products and availability in real time." },
  { icon: Package, title: "Simple Checkout", text: "A clear and convenient ordering process." },
  { icon: Radar, title: "Order Tracking", text: "Know what is happening with your order." },
  {
    icon: CreditCard,
    title: "Secure Payments",
    text: "Handled through secure payment infrastructure.",
  },
];

const journey = [
  { step: "01", title: "Browse", text: "Explore the menu." },
  { step: "02", title: "Choose", text: "Select your favorite products." },
  { step: "03", title: "Cart", text: "Review your order." },
  { step: "04", title: "Checkout", text: "Provide the required information." },
  { step: "05", title: "Pay", text: "Complete payment." },
  { step: "06", title: "Track", text: "Follow your order status." },
];

const methods = [
  { icon: Utensils, title: "Dine-in", text: "Enjoy your meal at the café." },
  { icon: Store, title: "Takeaway", text: "Order ahead and collect your food." },
  { icon: Truck, title: "Delivery", text: "Have your order delivered to your location." },
];

function Home() {
  const loaderData = Route.useLoaderData();
  const [categoriesList, setCategoriesList] = useState<Category[]>(
    loaderData?.categories && loaderData.categories.length > 0 ? loaderData.categories : seedCategories,
  );
  const [productsList, setProductsList] = useState<Product[]>(
    loaderData?.products && loaderData.products.length > 0 ? loaderData.products : seedProducts,
  );
  const initialActivePromo =
    loaderData?.promotions?.find((p) => p.status === "active") || loaderData?.promotions?.[0] || null;
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(initialActivePromo);

  useEffect(() => {
    if (loaderData?.products && loaderData.products.length > 0) {
      registerProducts(loaderData.products);
    }
  }, [loaderData?.products]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [cats, prods, promos] = await Promise.all([
          fetchCategories().catch(() => seedCategories),
          fetchProducts().catch(() => seedProducts),
          fetchPromotions().catch(() => []),
        ]);
        if (!cancelled) {
          if (cats && cats.length > 0) setCategoriesList(cats);
          if (prods && prods.length > 0) {
            setProductsList(prods);
            registerProducts(prods);
          }
          if (promos && promos.length > 0) {
            const firstActive = promos.find((p) => p.status === "active") || promos[0];
            if (firstActive) setActivePromotion(firstActive);
          }
        }
      } catch (err) {
        console.warn("Failed to load home page dynamic data:", err);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = productsList.filter((p) => p.featured);
  const displayFeatured = featured.length > 0 ? featured : productsList.slice(0, 3);
  const promoProduct = activePromotion
    ? productsList.find((p) => activePromotion.applicableProductIds.includes(p.id)) || getProduct(promotion.productId)
    : getProduct(promotion.productId);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img
          src={hero}
          alt="Freshly prepared burger meal at NEBA Café"
          width={1440}
          height={1800}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="overlay-hero absolute inset-0" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 md:py-36">
          <div className="rise-in max-w-2xl text-espresso-foreground">
            <Badge
              variant="secondary"
              className="mb-6 rounded-full px-3 py-1 text-xs tracking-widest"
            >
              NEBA CAFÉ · POWERED BY ORNIX-TECH
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.05] sm:text-5xl md:text-6xl">
              Good Food. Great Moments. Simply NEBA.
            </h1>
            <p className="mt-5 max-w-xl text-base opacity-90 md:text-lg">
              Discover your favorite meals, order with ease, and enjoy a seamless café experience
              powered by modern technology.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/menu">
                  Order Now <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/menu">Explore Menu</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading eyebrow="Categories" title="Find what you're craving" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categoriesList.map((c) => (
            <Link
              key={c.id}
              to="/menu/$category"
              params={{ category: c.slug }}
              className="surface-card hover-lift flex flex-col gap-1 p-5"
            >
              <span className="font-display text-lg font-semibold">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.tagline}</span>
              <ArrowRight className="mt-4 size-4 text-primary" />
            </Link>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Featured" title="Popular right now" />
          <Button asChild variant="outline">
            <Link to="/menu">View full menu</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayFeatured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Section>

      {promoProduct && (
        <Section className="pt-0">
          <div className="surface-card grid overflow-hidden md:grid-cols-2">
            <img
              src={promoProduct.image}
              alt={promoProduct.name}
              loading="lazy"
              width={768}
              height={768}
              className="h-64 w-full object-cover md:h-full"
            />
            <div className="flex flex-col justify-center gap-3 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {promotion.title}
              </p>
              <h2 className="text-3xl font-semibold">{promotion.headline}</h2>
              <p className="text-muted-foreground">{promotion.description}</p>
              <div className="flex items-center gap-3">
                <Badge className="rounded-full">{promotion.discountLabel}</Badge>
                <span className="text-sm text-muted-foreground">{promotion.expiresLabel}</span>
              </div>
              <p className="font-display text-2xl font-semibold">{formatETB(promoProduct.price)}</p>
              <Button asChild className="mt-2 self-start">
                <Link to="/product/$id" params={{ id: promoProduct.id }}>
                  Order the special
                </Link>
              </Button>
            </div>
          </div>
        </Section>
      )}

      <div className="bg-cream">
        <Section>
          <SectionHeading
            eyebrow="Why NEBA"
            title="Built around the way you order"
            align="center"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {benefits.map((b) => (
              <div key={b.title} className="surface-card hover-lift p-5">
                <b.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-4 font-display text-base font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <SectionHeading eyebrow="Ordering process" title="Six simple steps" align="center" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {journey.map((j) => (
            <li key={j.step} className="surface-card hover-lift p-5">
              <span className="font-display text-2xl font-semibold text-primary">{j.step}</span>
              <h3 className="mt-2 font-display text-base font-semibold">{j.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{j.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="Ordering methods" title="However you like to eat" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {methods.map((m) => (
            <div key={m.title} className="surface-card hover-lift flex items-start gap-4 p-6">
              <m.icon className="size-6 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="surface-card flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-display text-xl font-semibold">Visit NEBA Café</h2>
              <p className="text-sm text-muted-foreground">
                Address, phone and opening hours are placeholders until official details are
                provided.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
