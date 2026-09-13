import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Receipt,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/site/Section";
import { OrderTimeline } from "@/components/site/OrderTimeline";
import { formatETB, getProduct } from "@/lib/menu-data";
import { findOrder, methodLabels, statusLabels, type Order } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/order/$id")({
  head: () => ({
    meta: [
      { title: "Order Confirmation & Tracking — NEBA Café" },
      {
        name: "description",
        content: "Confirmation details and live tracking for your NEBA Café order.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Order Confirmation — NEBA Café" },
      { property: "og:description", content: "Your NEBA Café order has been confirmed." },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<{ loading: boolean; order: Order | null }>({
    loading: true,
    order: null,
  });

  useEffect(() => {
    // Read-only retrieval of the saved order by ID or order number
    const found = findOrder(id) ?? null;
    setState({ loading: false, order: found });
  }, [id]);

  if (state.loading) {
    return (
      <Section className="max-w-4xl py-20 text-center">
        <p className="text-muted-foreground animate-pulse">Loading order details…</p>
      </Section>
    );
  }

  if (!state.order) {
    return (
      <Section className="max-w-2xl py-20">
        <EmptyState
          icon={<Receipt className="size-10 text-muted-foreground" />}
          title="Order Not Found"
          description={`We couldn't find an order with identifier "${id}" on this device. Please verify your order number or browse our menu.`}
          action={
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/menu">Back to Menu</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/orders">View Order History</Link>
              </Button>
            </div>
          }
        />
      </Section>
    );
  }

  const order = state.order;
  const isDelivery = order.method === "delivery";
  const isDineIn = order.method === "dine-in";
  const isTakeaway = order.method === "takeaway";

  const MethodIcon = isDelivery ? Truck : isTakeaway ? Store : Utensils;
  const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Section className="max-w-5xl">
      {/* 1. TOP SUCCESS BANNER & CONFIRMATION HEADER */}
      <header className="rise-in surface-card overflow-hidden p-6 sm:p-10 text-center relative border-primary/20">
        <div className="mx-auto flex size-16 sm:size-20 items-center justify-center rounded-full bg-success/15 text-success ring-8 ring-success/5">
          <CheckCircle2 className="size-10 sm:size-12" aria-hidden />
        </div>

        <div className="mt-5">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-xs uppercase tracking-wider font-semibold"
          >
            Order Placed Successfully
          </Badge>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-semibold">
            Thank you for your order!
          </h1>
          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-muted-foreground">
            Your order has been received by the NEBA Café kitchen and is currently being processed.
            A copy has been recorded on this device.
          </p>
        </div>

        {/* Quick info summary strip */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-border bg-secondary/30 p-4 text-left">
          <div>
            <span className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Order number
            </span>
            <span className="font-display text-lg sm:text-xl font-bold text-foreground">
              {order.number}
            </span>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Placed at
            </span>
            <span className="text-sm sm:text-base font-medium text-foreground">
              {new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Current status
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-medium text-primary">
              <span className="size-2 rounded-full bg-primary animate-pulse" aria-hidden />
              {statusLabels[order.status]}
            </span>
          </div>

          <div>
            <span className="block text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Total paid
            </span>
            <span className="font-display text-lg sm:text-xl font-bold text-primary">
              {formatETB(order.total)}
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT GRID: PROGRESS/DETAILS & SUMMARY */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_1fr] items-start">
        {/* LEFT COLUMN: LIVE TRACKING & DETAILS */}
        <div className="space-y-8">
          {/* Card: Order Status / Tracking Timeline */}
          <section aria-labelledby="tracking-heading" className="surface-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 id="tracking-heading" className="font-display text-xl font-semibold">
                  Live order progress
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Follow your order from kitchen receipt to completion.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5 py-1 px-3">
                <Clock className="size-3.5 text-primary" aria-hidden />
                <span>Est. 15–25 mins</span>
              </Badge>
            </div>

            <div className="mt-6">
              <OrderTimeline order={order} />
            </div>

            <div className="mt-2 rounded-lg bg-muted/40 p-3.5 text-xs text-muted-foreground flex items-center gap-2">
              <span className="font-medium text-foreground">Notice:</span>
              <span>
                Status updates reflect kitchen operations. You can refresh or revisit this link at
                any time to check your status.
              </span>
            </div>
          </section>

          {/* Card: Order & Customer Details */}
          <section aria-labelledby="details-heading" className="surface-card p-6 sm:p-8">
            <h2
              id="details-heading"
              className="font-display text-xl font-semibold border-b border-border pb-4"
            >
              Order & fulfillment details
            </h2>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <MethodIcon className="size-5" aria-hidden />
                </span>
                <div>
                  <dt className="text-xs text-muted-foreground font-medium">Ordering method</dt>
                  <dd className="font-medium text-foreground text-base">
                    {methodLabels[order.method]}
                  </dd>
                </div>
              </div>

              {isDineIn && (
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Utensils className="size-5" aria-hidden />
                  </span>
                  <div>
                    <dt className="text-xs text-muted-foreground font-medium">Table assignment</dt>
                    <dd className="font-display text-base font-semibold text-foreground">
                      Table #{order.customer.table || "Not specified"}
                    </dd>
                  </div>
                </div>
              )}

              {order.customer.name && order.customer.name !== "Dine-in guest" && (
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Receipt className="size-5" aria-hidden />
                  </span>
                  <div>
                    <dt className="text-xs text-muted-foreground font-medium">Customer name</dt>
                    <dd className="font-medium text-foreground">{order.customer.name}</dd>
                  </div>
                </div>
              )}

              {order.customer.phone && (
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Phone className="size-5" aria-hidden />
                  </span>
                  <div>
                    <dt className="text-xs text-muted-foreground font-medium">Contact phone</dt>
                    <dd className="font-medium text-foreground">{order.customer.phone}</dd>
                  </div>
                </div>
              )}

              {isDelivery && order.customer.address && (
                <div className="sm:col-span-2 flex items-start gap-3 border-t border-border/50 pt-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <div>
                    <dt className="text-xs text-muted-foreground font-medium">Delivery address</dt>
                    <dd className="font-medium text-foreground">{order.customer.address}</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* RIGHT COLUMN: ITEMS SUMMARY & PAYMENT */}
        <div className="space-y-8">
          {/* Card: Order Summary & Line Items */}
          <section aria-labelledby="summary-heading" className="surface-card p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 id="summary-heading" className="font-display text-xl font-semibold">
                Items ordered
              </h2>
              <span className="text-xs font-medium text-muted-foreground">
                {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}
              </span>
            </div>

            {/* List of ordered products with images */}
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item) => {
                const product = getProduct(item.productId);
                return (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {product?.image ? (
                        <img
                          src={product.image}
                          alt={item.name}
                          loading="lazy"
                          width={48}
                          height={48}
                          className="size-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ShoppingBag className="size-5" aria-hidden />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatETB(item.price)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground whitespace-nowrap">
                      {formatETB(item.price * item.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Cost Breakdown */}
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium text-foreground">{formatETB(order.subtotal)}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery fee</dt>
                <dd className="font-medium text-foreground">
                  {order.delivery > 0 ? formatETB(order.delivery) : "0 ETB (Free)"}
                </dd>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount</dt>
                  <dd className="font-medium">-{formatETB(order.discount)}</dd>
                </div>
              )}

              <div className="flex justify-between border-t border-border pt-3 font-display text-xl font-semibold">
                <dt>Order Total</dt>
                <dd className="text-primary">{formatETB(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* Card: Payment Information */}
          <section aria-labelledby="payment-heading" className="surface-card p-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <CreditCard className="size-4 text-primary" aria-hidden />
              <h3 id="payment-heading" className="font-display text-base font-semibold">
                Payment information
              </h3>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-medium text-foreground">
                  {order.paymentMethod || "Mobile Payment"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Payment status</dt>
                <dd>
                  <Badge
                    variant={order.paymentStatus === "paid" ? "default" : "secondary"}
                    className={cn(
                      order.paymentStatus === "paid" &&
                        "bg-success text-success-foreground hover:bg-success",
                    )}
                  >
                    {order.paymentStatus === "paid" ? "Paid" : `Payment ${order.paymentStatus}`}
                  </Badge>
                </dd>
              </div>
            </dl>

            <p className="mt-4 rounded-lg bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Demo notification: Payment verification is mocked locally. Official banking
              integration will authenticate real-time settlement during backend deployment.
            </p>
          </section>

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            <Button asChild size="lg" className="w-full">
              <Link to="/menu">
                <ShoppingBag className="size-4 mr-2" />
                Continue Shopping
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/orders">
                <Receipt className="size-4 mr-2" />
                View All Past Orders
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
