import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Section } from "@/components/site/Section";
import { formatETB } from "@/lib/menu-data";
import { methodLabels, readOrders, statusLabels, type Order } from "@/lib/orders";
import { fetchOrderById } from "@/services/api";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — NEBA Café" },
      { name: "description", content: "View your NEBA Café order history and track current orders." },
      { property: "og:title", content: "My Orders — NEBA Café" },
      { property: "og:description", content: "Your NEBA Café order history." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const local = readOrders();
    setOrders(local);

    if (local.length > 0) {
      void Promise.all(
        local.map((o) =>
          fetchOrderById(o.id)
            .then((updated) => updated || o)
            .catch(() => o),
        ),
      ).then((refreshed) => {
        setOrders(refreshed);
      });
    }
  }, []);

  return (
    <Section className="max-w-3xl">
      <h1 className="text-4xl font-semibold">My orders</h1>

      <div className="mt-8 space-y-4">
        {orders === null && <p className="text-muted-foreground">Loading orders…</p>}

        {orders?.length === 0 && (
          <EmptyState
            icon={<Receipt className="size-8" />}
            title="No orders yet"
            description="Once you place an order it will appear here with live status."
            action={
              <Button asChild>
                <Link to="/menu">Explore Menu</Link>
              </Button>
            }
          />
        )}

        {orders?.map((order) => (
          <article key={order.id} className="surface-card flex flex-wrap items-center gap-4 p-5">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold">Order {order.number}</h2>
                <Badge variant="secondary">{statusLabels[order.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(order.createdAt).toLocaleString()} · {methodLabels[order.method]} ·{" "}
                {order.items.length} item(s)
              </p>
            </div>
            <span className="font-semibold">{formatETB(order.total)}</span>
            <Button asChild variant="outline">
              <Link to="/order/$id" params={{ id: order.id }}>
                Track order
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </Section>
  );
}
