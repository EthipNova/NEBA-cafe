import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { formatETB, type Product } from "@/lib/menu-data";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <article className="group surface-card hover-lift flex flex-col overflow-hidden">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-4/3 overflow-hidden bg-muted"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={768}
          height={768}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!product.available && (
          <span className="absolute inset-0 flex items-center justify-center bg-espresso/60">
            <Badge variant="secondary" className="text-xs uppercase tracking-widest">
              Unavailable
            </Badge>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold leading-tight">
            <Link to="/product/$id" params={{ id: product.id }}>
              {product.name}
            </Link>
          </h3>
          <span className="whitespace-nowrap text-sm font-semibold text-primary">
            {formatETB(product.price)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>

        <Button
          className="mt-3 w-full"
          disabled={!product.available}
          onClick={() => {
            add(product.id);
            toast.success(`${product.name} added to cart`);
          }}
        >
          <Plus className="size-4" />
          {product.available ? "Add to Cart" : "Unavailable"}
        </Button>
      </div>
    </article>
  );
}
