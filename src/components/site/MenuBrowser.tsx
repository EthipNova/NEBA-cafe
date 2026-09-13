import { Link } from "@tanstack/react-router";
import { Search, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/site/Section";
import { ProductCard } from "@/components/site/ProductCard";
import { categories, products } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

export function MenuBrowser({ activeCategory }: { activeCategory?: string }) {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.categorySlug !== activeCategory) return false;
      if (availableOnly && !p.available) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });
  }, [query, availableOnly, activeCategory]);

  const current = categories.find((c) => c.slug === activeCategory);

  return (
    <Section>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Menu</p>
        <h1 className="mt-3 text-4xl font-semibold">{current ? current.name : "Our full menu"}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {current ? current.tagline : "Burgers, pizza, sides and drinks — freshly prepared."}
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/menu"
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            !activeCategory
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-secondary",
          )}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            to="/menu/$category"
            params={{ category: c.slug }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              activeCategory === c.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary",
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu..."
            aria-label="Search menu"
            className="pl-9"
          />
        </div>
        <Button
          variant={availableOnly ? "default" : "outline"}
          onClick={() => setAvailableOnly((v) => !v)}
          aria-pressed={availableOnly}
        >
          Available only
        </Button>
      </div>

      <div className="mt-8">
        {results.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="size-8" />}
            title="No matching products"
            description="Try a different search term or category."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
