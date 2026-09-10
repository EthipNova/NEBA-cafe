import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  RotateCcw,
  Search,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/site/Section";
import { formatETB, getProduct } from "@/lib/menu-data";
import { methodLabels, readOrders, statusLabels, type Order } from "@/lib/orders";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments Management — NEBA Café" },
      { name: "description", content: "View and manage customer payment records and revenue." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPayments,
});

function PaymentStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 bg-success/15 text-success border-success/30 font-medium text-xs py-0.5 px-2"
      >
        <CheckCircle2 className="size-3" aria-hidden />
        <span>Paid</span>
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge
        variant="secondary"
        className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium text-xs py-0.5 px-2"
      >
        <Clock className="size-3" aria-hidden />
        <span>Pending</span>
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge
        variant="destructive"
        className="inline-flex items-center gap-1 font-medium text-xs py-0.5 px-2"
      >
        <AlertCircle className="size-3" aria-hidden />
        <span>Failed</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs uppercase">
      {status}
    </Badge>
  );
}

function getItemCount(order: Order): number {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function AdminPayments() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    // Read payments derived directly from existing customer orders in localStorage
    setOrders(readOrders());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "neba.orders.v1" || e.key === null) {
        setOrders(readOrders());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const safeOrders = orders ?? [];

  // Summary Metrics derived directly from orders
  const paidOrders = safeOrders.filter((o) => o.paymentStatus === "paid");
  const pendingOrders = safeOrders.filter((o) => o.paymentStatus === "pending");
  const failedOrders = safeOrders.filter((o) => o.paymentStatus === "failed");

  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const failedAmount = failedOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Distinct payment methods available in actual data
  const availablePaymentMethods = Array.from(
    new Set(safeOrders.map((o) => o.paymentMethod).filter(Boolean)),
  );

  // Filter orders
  const filteredOrders = safeOrders.filter((o) => {
    if (statusFilter !== "all" && o.paymentStatus !== statusFilter) {
      return false;
    }

    if (methodFilter !== "all" && o.paymentMethod !== methodFilter) {
      return false;
    }

    if (orderTypeFilter !== "all" && o.method !== orderTypeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const numMatch = (o.number || "").toLowerCase().includes(q);
      const nameMatch = (o.customer?.name || "").toLowerCase().includes(q);
      const phoneMatch = (o.customer?.phone || "").toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !phoneMatch) {
        return false;
      }
    }

    return true;
  });

  // Sort orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
    if (sortBy === "oldest") {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    }
    if (sortBy === "highest") {
      return (b.total || 0) - (a.total || 0);
    }
    if (sortBy === "lowest") {
      return (a.total || 0) - (b.total || 0);
    }
    return 0;
  });

  const selectedOrder =
    safeOrders.find((o) => o.id === selectedOrderId || o.number === selectedOrderId) ?? null;

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setMethodFilter("all");
    setOrderTypeFilter("all");
    setSortBy("newest");
  };

  const isFiltered =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    orderTypeFilter !== "all" ||
    sortBy !== "newest";

  return (
    <div className="space-y-8">
      {/* 1. HEADER & OVERVIEW */}
      <header>
        <h1 className="font-display text-3xl font-semibold">Payments management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor customer transactions, settlement states, and café revenue.
        </p>
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground inline-flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
            Demo notice
          </Badge>
          <span>
            Payment records are recorded from customer orders on this device. Live settlement will
            connect to backend gateway verification.
          </span>
        </div>
      </header>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="surface-card p-5 space-y-1.5 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="size-4" aria-hidden />
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatETB(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground">
            {paidOrders.length} settled {paidOrders.length === 1 ? "order" : "orders"}
          </p>
        </div>

        {/* Paid Payments */}
        <div className="surface-card p-5 space-y-1.5 border-l-4 border-l-success">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Paid Transactions
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="size-4" aria-hidden />
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatETB(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground">
            {paidOrders.length} verified {paidOrders.length === 1 ? "payment" : "payments"}
          </p>
        </div>

        {/* Pending Payments */}
        <div className="surface-card p-5 space-y-1.5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Payments
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-4" aria-hidden />
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatETB(pendingAmount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingOrders.length} awaiting settlement
          </p>
        </div>

        {/* Failed Payments */}
        <div className="surface-card p-5 space-y-1.5 border-l-4 border-l-destructive">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Failed Transactions
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-4" aria-hidden />
            </div>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {formatETB(failedAmount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {failedOrders.length} rejected {failedOrders.length === 1 ? "attempt" : "attempts"}
          </p>
        </div>
      </div>

      {/* 3. SEARCH & FILTER CONTROLS */}
      <div className="surface-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search by order #, customer, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Search payment records"
            />
          </div>

          {/* Payment Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm" aria-label="Filter by payment status">
              <SelectValue placeholder="Payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Method Filter */}
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 text-sm" aria-label="Filter by payment method">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment methods</SelectItem>
              {availablePaymentMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Order Method Filter */}
          <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
            <SelectTrigger className="h-9 text-sm" aria-label="Filter by fulfillment method">
              <SelectValue placeholder="Order method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All order methods</SelectItem>
              <SelectItem value="dine-in">Dine-in</SelectItem>
              <SelectItem value="takeaway">Takeaway</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Secondary controls row: Sorting & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden />
            <span>Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-7 text-xs w-[140px]" aria-label="Sort transactions">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="highest">Highest amount</SelectItem>
                <SelectItem value="lowest">Lowest amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Showing <strong>{sortedOrders.length}</strong> of <strong>{safeOrders.length}</strong>{" "}
              transactions
            </span>
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                onClick={resetFilters}
              >
                <RotateCcw className="size-3" aria-hidden />
                Reset filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. TRANSACTIONS TABLE */}
      {orders === null ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          <p className="animate-pulse">Loading payment records…</p>
        </div>
      ) : safeOrders.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-8 text-muted-foreground" />}
          title="No payment records yet"
          description="Transactions will appear here once customer orders are placed through checkout."
        />
      ) : sortedOrders.length === 0 ? (
        <div className="surface-card p-12 text-center space-y-3">
          <p className="text-base font-medium">No matching payments found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No transaction records match your current filter and search query. Try adjusting your
            criteria.
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden />
            Reset all filters
          </Button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Order
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Customer
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Fulfillment
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Payment Method
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((o) => (
                  <TableRow
                    key={o.id || o.number}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedOrderId(o.id || o.number)}
                  >
                    <TableCell className="font-display font-semibold text-foreground whitespace-nowrap">
                      {o.number}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {new Date(o.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {o.customer?.name || "Guest diner"}
                      {o.customer?.phone && (
                        <span className="block text-xs text-muted-foreground font-normal">
                          {o.customer.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="text-xs font-normal">
                        {methodLabels[o.method] || o.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="size-3.5 text-muted-foreground" aria-hidden />
                        {o.paymentMethod || "Mobile Payment"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-right font-display font-semibold text-foreground whitespace-nowrap">
                      {formatETB(o.total)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-primary hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(o.id || o.number);
                        }}
                      >
                        <Eye className="size-3.5 mr-1" aria-hidden />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 5. PAYMENT DETAILS DRAWER */}
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
              {/* Header */}
              <SheetHeader className="text-left space-y-2 pb-4 border-b border-border">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <SheetTitle className="font-display text-2xl font-bold">
                    Payment #{selectedOrder.number}
                  </SheetTitle>
                  <PaymentStatusBadge status={selectedOrder.paymentStatus} />
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Recorded on{" "}
                  {new Date(selectedOrder.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at{" "}
                  {new Date(selectedOrder.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </SheetDescription>
              </SheetHeader>

              {/* Payment Summary Box */}
              <section aria-labelledby="drawer-payment-summary" className="space-y-3">
                <h3
                  id="drawer-payment-summary"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Payment Breakdown
                </h3>
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Payment Method</span>
                    <span className="font-medium text-foreground">
                      {selectedOrder.paymentMethod || "Mobile Payment"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Payment Status</span>
                    <PaymentStatusBadge status={selectedOrder.paymentStatus} />
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground text-xs font-medium">Total Paid</span>
                    <span className="font-display text-xl font-bold text-primary">
                      {formatETB(selectedOrder.total)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Related Order Information */}
              <section aria-labelledby="drawer-order-details" className="space-y-3">
                <h3
                  id="drawer-order-details"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Order Details
                </h3>
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Order Number</span>
                    <span className="font-semibold text-foreground">{selectedOrder.number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Fulfillment Method</span>
                    <span className="font-medium text-foreground">
                      {methodLabels[selectedOrder.method] || selectedOrder.method}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Order Stage</span>
                    <Badge variant="outline" className="text-xs font-medium">
                      {statusLabels[selectedOrder.status] || selectedOrder.status}
                    </Badge>
                  </div>
                </div>
              </section>

              {/* Customer Information */}
              <section aria-labelledby="drawer-customer-info" className="space-y-3">
                <h3
                  id="drawer-customer-info"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Customer Information
                </h3>
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5 text-sm">
                  {selectedOrder.customer?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Name</span>
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

                  {selectedOrder.method === "dine-in" && selectedOrder.customer?.table && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Table</span>
                      <span className="font-semibold text-foreground">
                        Table #{selectedOrder.customer.table}
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

              {/* Itemized Order List */}
              <section aria-labelledby="drawer-items-list" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3
                    id="drawer-items-list"
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Items In Order
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

              {/* Financial Calculation */}
              <section aria-labelledby="drawer-financial-calc" className="space-y-3">
                <h3
                  id="drawer-financial-calc"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Financial Summary
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
                    <span>Final Total</span>
                    <span className="text-primary">{formatETB(selectedOrder.total)}</span>
                  </div>
                </div>
              </section>

              {/* Demo Notice & Close */}
              <div className="pt-2 mt-auto border-t border-border space-y-3">
                <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg leading-relaxed">
                  Notice: Payment record is verified from client simulation. Real bank and mobile
                  money settlement will be confirmed by backend webhook verification.
                </p>
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
              <h3 className="font-display text-lg font-semibold">Payment record not found</h3>
              <p className="text-xs text-muted-foreground">
                The selected payment could not be retrieved from this device.
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
