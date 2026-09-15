import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, ExternalLink, Receipt, RefreshCw, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Section } from "@/components/site/Section";
import { formatETB } from "@/lib/menu-data";
import { methodLabels, readOrders, statusLabels, type Order } from "@/lib/orders";
import { fetchOrders } from "@/services/api";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — NEBA Café" },
      { name: "description", content: "View your NEBA Café order history and track current orders in real-time." },
      { property: "og:title", content: "My Orders — NEBA Café" },
      { property: "og:description", content: "Your NEBA Café order history." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const remote = await fetchOrders();
      setOrders(remote);
    } catch {
      setOrders([]);
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();

    // Supabase Realtime channel
    const channel = supabase
      .channel("my-orders-realtime")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "orders" }, () => {
        void loadData();
      })
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "payments" }, () => {
        void loadData();
      })
      .subscribe();

    // Storage event for fallback multi-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "neba.orders.v1") {
        void loadData();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Periodic polling every 8s
    const poll = setInterval(() => {
      void loadData();
    }, 8000);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("storage", handleStorage);
      clearInterval(poll);
    };
  }, []);

  return (
    <Section className="max-w-4xl py-8 sm:py-12 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold">My Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View live status updates and your complete order history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            <span>Sync</span>
          </Button>
          <Button asChild size="sm">
            <Link to="/account">Customer Dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {orders === null && (
          <div className="surface-card py-16 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading orders…</p>
          </div>
        )}

        {orders !== null && orders.length === 0 && (
          <EmptyState
            icon={<Receipt className="size-8" />}
            title="No orders found"
            description="Once you place an order it will appear here with live tracking."
            action={
              <Button asChild>
                <Link to="/menu">Explore Menu</Link>
              </Button>
            }
          />
        )}

        {orders?.map((order) => {
          const isPaid = order.paymentStatus === "paid";
          const isActive = order.status !== "completed";
          return (
            <article
              key={order.id}
              className="surface-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-all hover:border-primary/40"
            >
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold">Order {order.number}</h2>
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className={cn(
                      "text-xs py-0.5",
                      isActive && "bg-primary text-primary-foreground",
                    )}
                  >
                    {statusLabels[order.status]}
                  </Badge>
                  <Badge
                    variant={isPaid ? "outline" : "secondary"}
                    className={cn(
                      "text-xs py-0.5",
                      isPaid
                        ? "border-success/40 text-success bg-success/10"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
                    )}
                  >
                    {isPaid ? "Paid" : "Payment Pending"}
                  </Badge>
                  <Badge variant="outline" className="text-xs py-0.5 text-muted-foreground">
                    {methodLabels[order.method]}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {order.items.reduce((s, i) => s + i.quantity, 0)} item(s):{" "}
                  <span className="text-foreground/80 font-medium">
                    {order.items.map((i) => `${i.name} (×${i.quantity})`).join(", ")}
                  </span>
                </p>

                {order.customer.table && (
                  <p className="text-xs text-muted-foreground">
                    Table: <strong className="text-foreground">#{order.customer.table}</strong>
                  </p>
                )}
                {order.customer.address && (
                  <p className="text-xs text-muted-foreground">
                    Delivery Address: <strong className="text-foreground">{order.customer.address}</strong>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-border pt-3 sm:pt-0">
                <span className="font-display text-xl font-bold text-foreground">
                  {formatETB(order.total)}
                </span>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Link to="/order/$id" params={{ id: order.id }}>
                      <span>Track Order</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
