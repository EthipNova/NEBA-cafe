import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardStats, demoBoardOrders, revenueByHour } from "@/lib/admin-data";
import { formatETB, products } from "@/lib/menu-data";
import { methodLabels, statusLabels } from "@/lib/orders";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const unavailable = products.filter((p) => !p.available);
  const maxRevenue = Math.max(...revenueByHour.map((r) => r.revenue));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live operational overview (demo data).</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/orders">Open order board</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardStats.map((s) => (
          <div key={s.label} className="surface-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Revenue by hour</h2>
          <div className="mt-6 flex h-48 items-end gap-3">
            {revenueByHour.map((r) => (
              <div key={r.hour} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-primary transition-all"
                  style={{ height: `${(r.revenue / maxRevenue) * 100}%` }}
                  title={formatETB(r.revenue)}
                />
                <span className="text-xs text-muted-foreground">{r.hour}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <AlertTriangle className="size-4 text-warning" aria-hidden /> Needs attention
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {unavailable.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>{p.name}</span>
                <Badge variant="outline">Unavailable</Badge>
              </li>
            ))}
            {demoBoardOrders
              .filter((o) => o.paymentStatus !== "paid")
              .map((o) => (
                <li key={o.number} className="flex items-center justify-between">
                  <span>
                    {o.number} · {methodLabels[o.method]}
                  </span>
                  <Badge variant={o.paymentStatus === "failed" ? "destructive" : "secondary"}>
                    Payment {o.paymentStatus}
                  </Badge>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="surface-card overflow-x-auto p-6">
        <h2 className="font-display text-lg font-semibold">Recent orders</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Order</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Method</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {demoBoardOrders.map((o) => (
              <tr key={o.number} className="border-t border-border">
                <td className="py-3 font-medium">{o.number}</td>
                <td className="py-3">{o.customer}</td>
                <td className="py-3">{methodLabels[o.method]}</td>
                <td className="py-3">
                  <Badge variant="secondary">{statusLabels[o.status]}</Badge>
                </td>
                <td className="py-3 text-right">{formatETB(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
