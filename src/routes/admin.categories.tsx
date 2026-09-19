import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createAdminCategory,
  fetchAdminCategories,
  toggleAdminCategoryActive,
  type AdminCategory,
} from "@/lib/categories";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories — NEBA Café Admin" },
      {
        name: "description",
        content: "Organise the menu and control what customers see.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCategories,
});

function AdminCategories() {
  const [rows, setRows] = useState<AdminCategory[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchAdminCategories();
      if (error) {
        setError(error.message);
        return;
      }
      setRows(data || []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const create = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await createAdminCategory({ name: trimmed });
      if (error || !data) {
        toast.error(error?.message || "Failed to create category");
        return;
      }

      setRows((prev) => [...prev, data]);
      setName("");
      toast.success(`Category "${data.name}" created successfully.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (c: AdminCategory, checked: boolean) => {
    const previousState = c.active;
    setTogglingId(c.id);

    // Optimistically update local state
    setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, active: checked } : r)));

    try {
      const { success, error } = await toggleAdminCategoryActive(c.id, checked);
      if (!success) {
        // Rollback to previous state on failure
        setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, active: previousState } : r)));
        toast.error(error?.message || "Failed to update category status");
      } else {
        toast.success(`${c.name} ${checked ? "activated" : "deactivated"}`);
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organise the menu and control what customers see.
        </p>
      </header>

      <form onSubmit={create} className="surface-card flex flex-wrap gap-3 p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          className="max-w-xs"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting}>
          <Plus className="size-4" /> {isSubmitting ? "Adding…" : "Add category"}
        </Button>
      </form>

      {loading ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          <p className="animate-pulse">Loading menu categories from Supabase…</p>
        </div>
      ) : error ? (
        <div className="surface-card p-12 text-center space-y-4 border-destructive/20 bg-destructive/5">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Failed to load categories</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadData()} className="gap-1.5">
            <RotateCcw className="size-3.5" aria-hidden />
            <span>Retry connection</span>
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">No categories yet.</p>
          <p className="text-xs text-muted-foreground">Create your first menu category above.</p>
        </div>
      ) : (
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
                  disabled={togglingId === c.id}
                  aria-label={`Toggle ${c.name}`}
                  onCheckedChange={(checked) => handleToggleActive(c, checked)}
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{c.productCount} product(s)</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
