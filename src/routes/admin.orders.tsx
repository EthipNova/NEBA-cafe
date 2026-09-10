import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Eye,
  MapPin,
  Phone,
  Receipt,
  ShoppingBag,
  Truck,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/site/Section";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { boardColumns } from "@/lib/admin-data";
import { formatETB, getProduct } from "@/lib/menu-data";
import {
  flowFor,
  methodLabels,
  readOrders,
  statusLabels,
  updateOrderStatus,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Staff Orders Board — NEBA Café" },
      { name: "description", content: "Manage live orders for NEBA Café kitchen and staff." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrders,
});

function nextStatus(order: Order): OrderStatus | null {
  const flow = flowFor(order.method);
  const i = flow.indexOf(order.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1]! : null;
}

function getCustomerDisplay(order: Order): string {
  if (order.method === "dine-in") {
    if (order.customer?.table) {
      const hasName = order.customer.name && order.customer.name !== "Dine-in guest";
      return hasName
        ? `${order.customer.name} (Table ${order.customer.table})`
        : `Table ${order.customer.table}`;
    }
    return order.customer?.name || "Dine-in guest";
  }
  return (
    order.customer?.name || (order.method === "takeaway" ? "Takeaway guest" : "Delivery customer")
  );
}

function getItemCount(order: Order): number {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function getOrderTime(order: Order): string {
  if (!order.createdAt) return "";
  try {
    return new Date(order.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Load real customer orders from neba.orders.v1 on client mount
    setOrders(readOrders());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "neba.orders.v1" || e.key === null) {
        setOrders(readOrders());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const advance = (idOrNumber: string) => {
    setOrders((prev) => {
      if (!prev) return prev;
      const target = prev.find((o) => o.id === idOrNumber || o.number === idOrNumber);
      if (!target) return prev;
      const next = nextStatus(target);
      if (!next) {
        toast.error("Invalid status transition");
        return prev;
      }

      // Persist the updated order status directly to neba.orders.v1 in localStorage
      updateOrderStatus(target.id, next);
      toast.success(`${target.number} → ${statusLabels[next]}`);

      // Update state immediately for instant UI response
      return prev.map((o) => (o.id === target.id ? { ...o, status: next } : o));
    });
  };

  // Sort orders by most recent first
  const sortedOrders = [...(orders ?? [])].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const activeOrders = sortedOrders.filter((o) =>
    ["received", "confirmed", "preparing", "ready"].includes(o.status),
  );
  const outForDeliveryOrders = sortedOrders.filter((o) => o.status === "out-for-delivery");
  const deliveredOrders = sortedOrders.filter((o) => o.status === "delivered");
  const completedOrders = sortedOrders.filter((o) => o.status === "completed");

  const selectedOrder =
    orders?.find((o) => o.id === selectedOrderId || o.number === selectedOrderId) ?? null;

  return (
    <div className="space-y-8">
      {/* Header & Overview Stats */}
      <header>
        <h1 className="font-display text-3xl font-semibold">Order management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live customer orders board. Move orders through kitchen, delivery, and fulfillment stages.
        </p>

        {orders && orders.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">
              <Utensils className="size-3.5 text-primary" aria-hidden />
              Active Kitchen: <strong className="text-foreground">{activeOrders.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">
              <Truck className="size-3.5 text-primary" aria-hidden />
              In Delivery:{" "}
              <strong className="text-foreground">
                {outForDeliveryOrders.length + deliveredOrders.length}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" aria-hidden />
              Completed: <strong className="text-foreground">{completedOrders.length}</strong>
            </span>
          </div>
        )}
      </header>

      {orders === null ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          <p className="animate-pulse">Loading orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-8 text-muted-foreground" />}
          title="No orders yet"
          description="New customer orders will appear here. As customers place orders through checkout, they will populate the board."
        />
      ) : (
        <>
          {/* SECTION 1: ACTIVE KITCHEN WORKFLOW (Pending → Confirmed → Preparing → Ready) */}
          <section aria-labelledby="active-orders-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="active-orders-heading" className="font-display text-xl font-semibold">
                  Active Orders
                </h2>
                <p className="text-xs text-muted-foreground">
                  Kitchen preparation workflow (Pending → Confirmed → Preparing → Ready)
                </p>
              </div>
              <Badge variant="secondary">{activeOrders.length} active</Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              {boardColumns.map((col) => {
                const columnOrders = activeOrders.filter((o) => o.status === col.status);
                return (
                  <section key={col.status} className="rounded-xl bg-card/60 p-3">
                    <h3 className="flex items-center justify-between px-1 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {col.label}
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {columnOrders.length}
                      </span>
                    </h3>
                    <ul className="space-y-3">
                      {columnOrders.length === 0 && (
                        <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          No orders
                        </li>
                      )}
                      {columnOrders.map((o) => {
                        const next = nextStatus(o);
                        const isDeliveryReady = o.status === "ready" && o.method === "delivery";

                        return (
                          <li key={o.id || o.number} className="surface-card p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-display font-semibold">{o.number}</span>
                              <Badge
                                variant={
                                  o.paymentStatus === "failed"
                                    ? "destructive"
                                    : o.paymentStatus === "pending"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {o.paymentStatus}
                              </Badge>
                            </div>

                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {getCustomerDisplay(o)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {methodLabels[o.method] || o.method} · {getItemCount(o)} item(s)
                                {getOrderTime(o) ? ` · ${getOrderTime(o)}` : ""}
                              </p>
                            </div>

                            {o.method === "delivery" && o.customer?.address && (
                              <p
                                className="text-xs text-muted-foreground truncate border-t border-border/50 pt-1.5"
                                title={o.customer.address}
                              >
                                📍 {o.customer.address}
                              </p>
                            )}

                            {isDeliveryReady && (
                              <div className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary font-medium flex items-center gap-1.5">
                                <Truck className="size-3 shrink-0" aria-hidden />
                                <span>Awaiting delivery dispatch</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                              <span className="text-muted-foreground">Total</span>
                              <span className="font-semibold text-foreground text-sm">
                                {formatETB(o.total)}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-medium"
                                onClick={() => setSelectedOrderId(o.id || o.number)}
                              >
                                <Eye className="size-3.5 mr-1" aria-hidden />
                                Details
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-xs font-medium"
                                onClick={() => advance(o.id || o.number)}
                                disabled={!next}
                              >
                                {(() => {
                                  if (!next) return "Completed";
                                  if (isDeliveryReady) return "Dispatch";
                                  return `Mark ${statusLabels[next]}`;
                                })()}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>

          {/* SECTION 2: DELIVERY & FULFILLMENT WORKFLOW (Out for Delivery → Delivered) */}
          <section
            aria-labelledby="delivery-workflow-heading"
            className="surface-card p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="size-5" aria-hidden />
                </div>
                <div>
                  <h2 id="delivery-workflow-heading" className="font-display text-xl font-semibold">
                    Delivery & Fulfillment
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Orders dispatched from café to customer (Out for Delivery → Delivered →
                    Completed)
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                {outForDeliveryOrders.length + deliveredOrders.length} in delivery
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Column: Out for Delivery */}
              <div className="rounded-xl bg-card/60 p-4 space-y-3">
                <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground pb-1 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary animate-pulse" aria-hidden />
                    Out for Delivery
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {outForDeliveryOrders.length}
                  </span>
                </h3>

                <ul className="space-y-3">
                  {outForDeliveryOrders.length === 0 && (
                    <li className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No deliveries currently in progress
                    </li>
                  )}
                  {outForDeliveryOrders.map((o) => {
                    const next = nextStatus(o);
                    return (
                      <li key={o.id || o.number} className="surface-card p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold">{o.number}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wider py-0 px-1.5 font-medium"
                            >
                              Delivery
                            </Badge>
                          </div>
                          <Badge
                            variant={
                              o.paymentStatus === "failed"
                                ? "destructive"
                                : o.paymentStatus === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {o.paymentStatus}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">
                            {o.customer?.name || "Delivery customer"}
                          </p>
                          {o.customer?.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="size-3 shrink-0" aria-hidden />
                              <span>{o.customer.phone}</span>
                            </p>
                          )}
                        </div>

                        {o.customer?.address && (
                          <div className="rounded-md bg-secondary/40 p-2 text-xs border border-border/50">
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-medium mb-0.5">
                              Delivery Address
                            </span>
                            <p className="font-medium text-foreground leading-relaxed flex items-start gap-1">
                              <MapPin
                                className="size-3.5 text-primary shrink-0 mt-0.5"
                                aria-hidden
                              />
                              <span>{o.customer.address}</span>
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                          <span className="text-muted-foreground">
                            {getItemCount(o)} item(s)
                            {getOrderTime(o) ? ` · ${getOrderTime(o)}` : ""}
                          </span>
                          <span className="font-semibold text-foreground text-sm">
                            {formatETB(o.total)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => setSelectedOrderId(o.id || o.number)}
                          >
                            <Eye className="size-3.5 mr-1" aria-hidden />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => advance(o.id || o.number)}
                            disabled={!next}
                          >
                            Mark Delivered
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Column: Delivered (Awaiting Final Completion) */}
              <div className="rounded-xl bg-card/60 p-4 space-y-3">
                <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground pb-1 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-success" aria-hidden />
                    Delivered
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {deliveredOrders.length}
                  </span>
                </h3>

                <ul className="space-y-3">
                  {deliveredOrders.length === 0 && (
                    <li className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No delivered orders awaiting completion
                    </li>
                  )}
                  {deliveredOrders.map((o) => {
                    const next = nextStatus(o);
                    return (
                      <li key={o.id || o.number} className="surface-card p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold">{o.number}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wider py-0 px-1.5 font-medium"
                            >
                              Delivery
                            </Badge>
                          </div>
                          <Badge
                            variant={
                              o.paymentStatus === "failed"
                                ? "destructive"
                                : o.paymentStatus === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {o.paymentStatus}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">
                            {o.customer?.name || "Delivery customer"}
                          </p>
                          {o.customer?.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="size-3 shrink-0" aria-hidden />
                              <span>{o.customer.phone}</span>
                            </p>
                          )}
                        </div>

                        {o.customer?.address && (
                          <div className="rounded-md bg-secondary/40 p-2 text-xs border border-border/50">
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-medium mb-0.5">
                              Delivered to
                            </span>
                            <p className="font-medium text-foreground leading-relaxed flex items-start gap-1">
                              <MapPin
                                className="size-3.5 text-success shrink-0 mt-0.5"
                                aria-hidden
                              />
                              <span>{o.customer.address}</span>
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                          <span className="text-muted-foreground">
                            {getItemCount(o)} item(s)
                            {getOrderTime(o) ? ` · ${getOrderTime(o)}` : ""}
                          </span>
                          <span className="font-semibold text-foreground text-sm">
                            {formatETB(o.total)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => setSelectedOrderId(o.id || o.number)}
                          >
                            <Eye className="size-3.5 mr-1" aria-hidden />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs font-medium"
                            onClick={() => advance(o.id || o.number)}
                            disabled={!next}
                          >
                            Mark Completed
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION 3: COMPLETED ORDERS */}
          <section
            aria-labelledby="completed-orders-heading"
            className="surface-card p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success">
                  <CheckCircle2 className="size-5" aria-hidden />
                </div>
                <div>
                  <h2 id="completed-orders-heading" className="font-display text-xl font-semibold">
                    Completed Orders
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Fulfilled dine-in, takeaway, and finalized delivery orders
                  </p>
                </div>
              </div>
              <Badge variant="outline">{completedOrders.length} completed</Badge>
            </div>

            {completedOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                No completed orders yet
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {completedOrders.map((o) => (
                  <li
                    key={o.id || o.number}
                    className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{o.number}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider py-0 px-1.5 font-medium"
                        >
                          {methodLabels[o.method] || o.method}
                        </Badge>
                      </div>
                      <Badge
                        variant="secondary"
                        className="gap-1 text-xs py-0.5 px-2 bg-success/15 text-success font-medium"
                      >
                        <CheckCircle2 className="size-3" aria-hidden />
                        Completed
                      </Badge>
                    </div>

                    <div className="text-sm">
                      <p className="font-medium text-foreground">{getCustomerDisplay(o)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getItemCount(o)} item(s)
                        {getOrderTime(o) ? ` · Placed ${getOrderTime(o)}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                      <span className="font-semibold text-foreground text-sm">
                        {formatETB(o.total)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => setSelectedOrderId(o.id || o.number)}
                      >
                        <Eye className="size-3 mr-1" aria-hidden />
                        Details
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Staff Order Details Drawer/Sheet */}
      <Sheet
        open={selectedOrderId !== null}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg overflow-y-auto p-6 flex flex-col gap-6"
        >
          {selectedOrder ? (
            <>
              {/* Order Header */}
              <SheetHeader className="text-left space-y-2 pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="font-display text-2xl font-bold">
                    Order {selectedOrder.number}
                  </SheetTitle>
                  <Badge
                    variant={
                      selectedOrder.status === "completed"
                        ? "outline"
                        : selectedOrder.status === "ready"
                          ? "default"
                          : "secondary"
                    }
                    className="text-xs uppercase tracking-wider font-semibold"
                  >
                    {statusLabels[selectedOrder.status] || selectedOrder.status}
                  </Badge>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Placed{" "}
                  {new Date(selectedOrder.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(selectedOrder.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {methodLabels[selectedOrder.method] || selectedOrder.method}
                </SheetDescription>
              </SheetHeader>

              {/* Customer & Fulfillment Information */}
              <section aria-labelledby="drawer-fulfillment" className="space-y-3">
                <h3
                  id="drawer-fulfillment"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Customer & Fulfillment
                </h3>
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Method</span>
                    <span className="font-medium text-foreground">
                      {methodLabels[selectedOrder.method] || selectedOrder.method}
                    </span>
                  </div>

                  {selectedOrder.method === "dine-in" && selectedOrder.customer?.table && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Table</span>
                      <span className="font-semibold text-foreground">
                        Table #{selectedOrder.customer.table}
                      </span>
                    </div>
                  )}

                  {selectedOrder.customer?.name &&
                    selectedOrder.customer.name !== "Dine-in guest" && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Customer name</span>
                        <span className="font-medium text-foreground">
                          {selectedOrder.customer.name}
                        </span>
                      </div>
                    )}

                  {selectedOrder.customer?.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Phone</span>
                      <span className="font-medium text-foreground">
                        {selectedOrder.customer.phone}
                      </span>
                    </div>
                  )}

                  {selectedOrder.method === "delivery" && selectedOrder.customer?.address && (
                    <div className="border-t border-border/50 pt-2 text-xs">
                      <span className="text-muted-foreground block mb-1">Delivery Address</span>
                      <span className="font-medium text-foreground leading-relaxed">
                        📍 {selectedOrder.customer.address}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Items Ordered Breakdown */}
              <section aria-labelledby="drawer-items" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3
                    id="drawer-items"
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Items Ordered
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">
                    {getItemCount(selectedOrder)}{" "}
                    {getItemCount(selectedOrder) === 1 ? "item" : "items"}
                  </span>
                </div>

                <ul className="divide-y divide-border rounded-xl border border-border bg-card/60 px-4">
                  {selectedOrder.items?.map((item, idx) => {
                    const product = getProduct(item.productId);
                    const imageSrc = product?.image;
                    const unitPrice = item.price || 0;
                    const quantity = item.quantity || 1;
                    const lineTotal = unitPrice * quantity;

                    return (
                      <li
                        key={item.productId || idx}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={item.name || "Product image"}
                              className="size-11 rounded-lg object-cover shrink-0 bg-muted"
                              loading="lazy"
                              width={44}
                              height={44}
                            />
                          ) : (
                            <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                              <ShoppingBag className="size-5" aria-hidden />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {item.name || "Unknown item"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {quantity} × {formatETB(unitPrice)}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-foreground text-sm whitespace-nowrap">
                          {formatETB(lineTotal)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Financial Breakdown */}
              <section aria-labelledby="drawer-financial" className="space-y-3">
                <h3
                  id="drawer-financial"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Financial Breakdown
                </h3>
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {formatETB(selectedOrder.subtotal)}
                    </span>
                  </div>

                  {selectedOrder.delivery > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery fee</span>
                      <span className="font-medium text-foreground">
                        {formatETB(selectedOrder.delivery)}
                      </span>
                    </div>
                  )}

                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-success font-medium">
                      <span>Discount</span>
                      <span>-{formatETB(selectedOrder.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
                    <span>Order Total</span>
                    <span className="text-primary">{formatETB(selectedOrder.total)}</span>
                  </div>
                </div>
              </section>

              {/* Payment Details */}
              <section aria-labelledby="drawer-payment" className="space-y-3">
                <h3
                  id="drawer-payment"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Payment Details
                </h3>
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Payment method</span>
                    <span className="font-medium text-foreground">
                      {selectedOrder.paymentMethod || "Mobile Payment"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Payment status</span>
                    <Badge
                      variant={
                        selectedOrder.paymentStatus === "paid"
                          ? "outline"
                          : selectedOrder.paymentStatus === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs uppercase font-medium"
                    >
                      {selectedOrder.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </section>

              {/* Actions Footer */}
              <div className="pt-2 mt-auto border-t border-border flex flex-col gap-2">
                {nextStatus(selectedOrder) ? (
                  <Button
                    className="w-full"
                    onClick={() => advance(selectedOrder.id || selectedOrder.number)}
                  >
                    Mark {statusLabels[nextStatus(selectedOrder)!]}
                  </Button>
                ) : (
                  <Button variant="secondary" disabled className="w-full">
                    Order Completed
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedOrderId(null)}
                >
                  Close
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center space-y-3 my-auto">
              <h3 className="font-display text-lg font-semibold">Order not found</h3>
              <p className="text-xs text-muted-foreground">
                The selected order could not be retrieved from this device.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrderId(null)}>
                Close
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
