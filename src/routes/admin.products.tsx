import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { categories, formatETB, products as seedProducts, type Product } from "@/lib/menu-data";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const [rows, setRows] = useState<Product[]>(seedProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState({ name: "", price: "", categorySlug: "burgers", description: "" });

  const openNew = () => {
    setEditing(null);
    setDraft({ name: "", price: "", categorySlug: "burgers", description: "" });
  };

  const save = () => {
    const price = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error("Enter a name and a valid price");
      return;
    }
    if (editing) {
      setRows((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, name: draft.name, price, categorySlug: draft.categorySlug, description: draft.description }
            : p,
        ),
      );
      toast.success("Product updated");
    } else {
      setRows((prev) => [
        {
          id: `p-new-${Date.now()}`,
          name: draft.name,
          slug: draft.name.toLowerCase().replace(/\s+/g, "-"),
          categorySlug: draft.categorySlug,
          description: draft.description,
          ingredients: [],
          price,
          image: seedProducts[0]!.image,
          available: true,
          featured: false,
        },
        ...prev,
      ]);
      toast.success("Product created");
    }
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, price and deactivate menu items. Changes are demo-only until the API is
            connected.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="size-4" /> New product
            </Button>
          </DialogTrigger>
          <ProductDialog
            title={editing ? "Edit product" : "New product"}
            draft={draft}
            setDraft={setDraft}
            onSave={save}
          />
        </Dialog>
      </header>

      <div className="surface-card overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Active</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.image}
                      alt=""
                      loading="lazy"
                      width={768}
                      height={768}
                      className="size-10 rounded-md object-cover"
                    />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="secondary">
                    {categories.find((c) => c.slug === p.categorySlug)?.name ?? p.categorySlug}
                  </Badge>
                </td>
                <td className="p-3">{formatETB(p.price)}</td>
                <td className="p-3">
                  <Switch
                    checked={p.available}
                    aria-label={`Toggle ${p.name}`}
                    onCheckedChange={(checked) => {
                      setRows((prev) =>
                        prev.map((r) => (r.id === p.id ? { ...r, available: checked } : r)),
                      );
                      toast.success(`${p.name} ${checked ? "activated" : "deactivated"}`);
                    }}
                  />
                </td>
                <td className="p-3 text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(p);
                          setDraft({
                            name: p.name,
                            price: String(p.price),
                            categorySlug: p.categorySlug,
                            description: p.description,
                          });
                        }}
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                    </DialogTrigger>
                    <ProductDialog title="Edit product" draft={draft} setDraft={setDraft} onSave={save} />
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Draft = { name: string; price: string; categorySlug: string; description: string };

function ProductDialog({
  title,
  draft,
  setDraft,
  onSave,
}: {
  title: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-price">Price (ETB)</Label>
          <Input
            id="p-price"
            type="number"
            min={1}
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-cat">Category</Label>
          <select
            id="p-cat"
            value={draft.categorySlug}
            onChange={(e) => setDraft({ ...draft, categorySlug: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-desc">Description</Label>
          <Input
            id="p-desc"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSave}>Save product</Button>
      </DialogFooter>
    </DialogContent>
  );
}
