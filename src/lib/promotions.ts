export type DiscountType = "percentage" | "fixed";
export type PromotionStatus = "active" | "scheduled" | "expired" | "draft";

export type Promotion = {
  id: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  applicableProductIds: string[]; // ["*"] denotes all products
  applicableCategorySlug?: string | undefined;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status?: PromotionStatus | undefined;
  minOrderAmount?: number | undefined;
  createdAt: string; // ISO date string
};

const STORAGE_KEY = "neba.promotions.v1";

export function derivePromotionStatus(promo: Promotion): PromotionStatus {
  if (promo.status === "draft") return "draft";

  const now = new Date();
  // Set current date to start of day for clean day comparison
  const todayStr = now.toISOString().split("T")[0]!;

  if (promo.startDate && promo.startDate > todayStr) {
    return "scheduled";
  }
  if (promo.endDate && promo.endDate < todayStr) {
    return "expired";
  }
  return "active";
}

export function formatDiscount(promo: Promotion): string {
  if (promo.discountType === "percentage") {
    return `${promo.discountValue}% OFF`;
  }
  return `${promo.discountValue.toLocaleString("en-US")} ETB OFF`;
}

export function readPromotions(): Promotion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Promotion[]) : [];
  } catch {
    return [];
  }
}

export function writePromotions(promotions: Promotion[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions));
  } catch {
    // Ignore storage quota or disabled localStorage errors
  }
}

export function savePromotion(promo: Promotion): Promotion {
  const all = [promo, ...readPromotions()];
  writePromotions(all);
  return promo;
}

export function updatePromotion(promo: Promotion): Promotion {
  const all = readPromotions().map((p) => (p.id === promo.id ? promo : p));
  writePromotions(all);
  return promo;
}

export function deletePromotion(id: string): void {
  const all = readPromotions().filter((p) => p.id !== id);
  writePromotions(all);
}
