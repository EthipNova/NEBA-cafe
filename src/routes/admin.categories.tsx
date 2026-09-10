import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { categories as seedCategories, products, type Category } from "@/lib/menu-data";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

function AdminCategories() {
  const [rows, setRows] = useState<Category[]>(seedCategories);
  const [name, setName] = useState("");

  const create = () => {
    if (!name.trim()) {
      toast.error("Enter a category name");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        tagline: "New category",
        active: true,
      },
    ]);
    setName("");
    toast.success("Category created");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">Organise the menu and control what customers see.</p>
      </header>

      <div className="surface-card flex flex-wrap gap-3 p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          className="max-w-xs"
        />
        <Button onClick={create}>
          <Plus className="size-4" /> Add category
        </Button>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <li key={c.id} className="surface-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                <p className="text-sm text-muted-foreground">{c.tagline}</p>
              </div>
              <Switch
                checked={c.active}
                aria-label={`Toggle ${c.name}`}
                onCheckedChange={(checked) => {
                  setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, active: checked } : r)));
                  toast.success(`${c.name} ${checked ? "activated" : "deactivated"}`);
                }}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {products.filter((p) => p.categorySlug === c.slug).length} product(s)
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
