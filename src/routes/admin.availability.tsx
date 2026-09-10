import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { products as seedProducts, type Product } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/availability")({
  component: AdminAvailability,
});

function AdminAvailability() {
  const [rows, setRows] = useState<Product[]>(seedProducts);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Flip an item off and customers can no longer add it to a new order.
        </p>
      </header>

      <ul className="surface-card divide-y divide-border">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  p.available ? "bg-success" : "bg-muted-foreground/40",
                )}
              />
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.available ? "Available" : "Unavailable"}
                </p>
              </div>
            </div>
            <Switch
              checked={p.available}
              aria-label={`Availability for ${p.name}`}
              onCheckedChange={(checked) => {
                setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, available: checked } : r)));
                toast.success(`${p.name} marked ${checked ? "available" : "unavailable"}`);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
