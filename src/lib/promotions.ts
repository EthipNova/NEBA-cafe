import { supabase } from "@/lib/supabase";

export type DiscountType = "percentage" | "fixed";
export type PromotionStatus = "active" | "scheduled" | "expired" | "draft";

export type PromotionProductItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId?: string | null | undefined;
};

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
  products?: PromotionProductItem[] | undefined;
};

export type CreatePromotionInput = {
  name: string;
  description?: string | undefined;
  discountType: DiscountType;
  discountValue: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: PromotionStatus;
  minOrderAmount?: number | null | undefined;
  categoryId?: string | null | undefined;
};

export type UpdatePromotionInput = CreatePromotionInput;

/**
 * Derives the operational status of a promotion based on its publication
 * mode and date schedule against the current calendar day.
 */
export function derivePromotionStatus(promo: Promotion): PromotionStatus {
  if (promo.status === "draft") return "draft";

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]!;

  if (promo.startDate && promo.startDate > todayStr) {
    return "scheduled";
  }
  if (promo.endDate && promo.endDate < todayStr) {
    return "expired";
  }
  return "active";
}

/**
 * Formats a user-facing string for discount value (e.g. "15% OFF" or "100 ETB OFF").
 */
export function formatDiscount(promo: {
  discountType: DiscountType;
  discountValue: number;
}): string {
  if (promo.discountType === "percentage") {
    return `${promo.discountValue}% OFF`;
  }
  return `${promo.discountValue.toLocaleString("en-US")} ETB OFF`;
}

/**
 * Formats currency values consistently in ETB without external dependencies.
 */
export function formatETB(amount: number): string {
  return `${amount.toLocaleString("en-US")} ETB`;
}

/**
 * Normalizes a raw Supabase promotion record into the frontend Promotion type.
 */
function normalizePromotionRecord(raw: any): Promotion {
  const categoryRaw = Array.isArray(raw.categories) ? raw.categories[0] : raw.categories;
  const promoProductsRaw = Array.isArray(raw.promotion_products) ? raw.promotion_products : [];

  const normalizedProducts: PromotionProductItem[] = [];
  const applicableProductIds: string[] = [];

  if (promoProductsRaw.length > 0) {
    for (const item of promoProductsRaw) {
      if (item && item.product_id) {
        applicableProductIds.push(item.product_id);
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        if (prod) {
          normalizedProducts.push({
            id: prod.id,
            name: prod.name || "Menu item",
            slug: prod.slug || "",
            price: Number(prod.price) || 0,
            imageUrl: prod.image_url ?? null,
            isAvailable: prod.is_available ?? true,
            categoryId: prod.category_id ?? null,
          });
        }
      }
    }
  }

  return {
    id: raw.id,
    name: raw.name || "Untitled Promotion",
    description: raw.description || "",
    discountType: (raw.discount_type as DiscountType) || "percentage",
    discountValue: Number(raw.discount_value) || 0,
    applicableProductIds: applicableProductIds.length > 0 ? applicableProductIds : ["*"],
    applicableCategorySlug: categoryRaw?.slug ?? undefined,
    startDate: raw.start_date || "",
    endDate: raw.end_date || "",
    status: (raw.status as PromotionStatus) || "draft",
    minOrderAmount: raw.min_order_amount ? Number(raw.min_order_amount) : undefined,
    createdAt: raw.created_at || new Date().toISOString(),
    products: normalizedProducts,
  };
}

/**
 * Fetches all promotions joined with their categories and targeted products.
 */
export async function fetchAdminPromotions(): Promise<{
  data: Promotion[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase.from("promotions" as any) as any)
      .select(`
        id,
        name,
        description,
        discount_type,
        discount_value,
        start_date,
        end_date,
        status,
        min_order_amount,
        category_id,
        created_at,
        categories (
          id,
          name,
          slug
        ),
        promotion_products (
          product_id,
          products (
            id,
            name,
            slug,
            price,
            image_url,
            is_available,
            category_id
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const records = (data || []).map(normalizePromotionRecord);
    return { data: records, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to fetch promotions"),
    };
  }
}

/**
 * Fetches available menu products from the real Supabase products table
 * for the promotion product selection checklist.
 */
export async function fetchPromotionProductsList(): Promise<{
  data: PromotionProductItem[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await (supabase.from("products" as any) as any)
      .select("id, name, slug, price, image_url, category_id, is_available")
      .order("name", { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const items: PromotionProductItem[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name || "Item",
      slug: p.slug || "",
      price: Number(p.price) || 0,
      imageUrl: p.image_url ?? null,
      isAvailable: p.is_available ?? true,
      categoryId: p.category_id ?? null,
    }));

    return { data: items, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Failed to load products list"),
    };
  }
}

/**
 * Generates an RFC 4122 v4 UUID string.
 * Uses crypto.randomUUID() when available (secure contexts/modern environments),
 * and falls back to crypto.getRandomValues() in non-secure HTTP contexts or older engines.
 */
function generatePromotionId(): string {
  const cryptoObj =
    typeof globalThis !== "undefined" && globalThis.crypto
      ? globalThis.crypto
      : typeof crypto !== "undefined"
      ? crypto
      : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);

    // RFC 4122 v4 compliance
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // 4-bit version 4 (0100)
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // 2-bit variant 1 (10)

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  throw new Error("No secure UUID generation API is available in this runtime.");
}

/**
 * Creates a promotion in Supabase and associates target products in promotion_products.
 * Generates a client-side UUID via generatePromotionId() because public.promotions.id
 * has no database default (column_default = NULL).
 * If targetProductIds is ["*"], zero rows are added to promotion_products (Universal Promotion).
 */
export async function createAdminPromotion(
  input: CreatePromotionInput,
  targetProductIds: string[],
): Promise<{ data: Promotion | null; error: Error | null }> {
  try {
    const promotionId = generatePromotionId();

    // 1. Construct insert payload with generated UUID
    const insertPayload: {
      id: string;
      name: string;
      description: string | null;
      discount_type: DiscountType;
      discount_value: number;
      start_date: string;
      end_date: string;
      status: PromotionStatus;
      min_order_amount: number | null;
      category_id: string | null;
    } = {
      id: promotionId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      min_order_amount: input.minOrderAmount ?? null,
      category_id: input.categoryId ?? null,
    };

    const { data: promo, error: promoError } = await (supabase.from("promotions" as any) as any)
      .insert(insertPayload)
      .select()
      .single();

    if (promoError || !promo) {
      return {
        data: null,
        error: new Error(promoError?.message || "Failed to insert promotion"),
      };
    }

    // 2. If targeting specific products, insert junction rows using the same promotionId
    const isUniversal = targetProductIds.includes("*") || targetProductIds.length === 0;
    if (!isUniversal) {
      const junctionRows = targetProductIds.map((pid) => ({
        promotion_id: promotionId,
        product_id: pid,
      }));

      const { error: junctionError } = await (supabase.from("promotion_products" as any) as any)
        .insert(junctionRows);

      if (junctionError) {
        return {
          data: null,
          error: new Error(
            `Promotion created, but failed to associate targeted products: ${junctionError.message}`,
          ),
        };
      }
    }

    return {
      data: {
        id: promo.id,
        name: promo.name,
        description: promo.description || "",
        discountType: promo.discount_type as DiscountType,
        discountValue: Number(promo.discount_value),
        applicableProductIds: isUniversal ? ["*"] : targetProductIds,
        startDate: promo.start_date,
        endDate: promo.end_date,
        status: promo.status as PromotionStatus,
        minOrderAmount: promo.min_order_amount ? Number(promo.min_order_amount) : undefined,
        createdAt: promo.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("An unexpected error occurred during creation"),
    };
  }
}

/**
 * Updates an existing promotion in Supabase and synchronizes its promotion_products junction rows.
 */
export async function updateAdminPromotion(
  id: string,
  input: UpdatePromotionInput,
  targetProductIds: string[],
): Promise<{ error: Error | null }> {
  try {
    // 1. Update promotion terms
    const updatePayload: {
      name: string;
      description: string | null;
      discount_type: DiscountType;
      discount_value: number;
      start_date: string;
      end_date: string;
      status: PromotionStatus;
      min_order_amount: number | null;
      category_id: string | null;
    } = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      min_order_amount: input.minOrderAmount ?? null,
      category_id: input.categoryId ?? null,
    };

    const { error: promoError } = await (supabase.from("promotions" as any) as any)
      .update(updatePayload)
      .eq("id", id);

    if (promoError) {
      return { error: new Error(promoError.message) };
    }

    // 2. Synchronize junction rows: remove existing associations
    const { error: deleteError } = await (supabase.from("promotion_products" as any) as any)
      .delete()
      .eq("promotion_id", id);

    if (deleteError) {
      return {
        error: new Error(
          `Promotion details updated, but failed to clear previous product associations: ${deleteError.message}`,
        ),
      };
    }

    // 3. Insert new junction rows if not universal
    const isUniversal = targetProductIds.includes("*") || targetProductIds.length === 0;
    if (!isUniversal) {
      const junctionRows = targetProductIds.map((pid) => ({
        promotion_id: id,
        product_id: pid,
      }));

      const { error: insertError } = await (supabase.from("promotion_products" as any) as any)
        .insert(junctionRows);

      if (insertError) {
        return {
          error: new Error(
            `Promotion details updated, but failed to save new product associations: ${insertError.message}`,
          ),
        };
      }
    }

    return { error: null };
  } catch (err: any) {
    return {
      error: err instanceof Error ? err : new Error("An unexpected error occurred during update"),
    };
  }
}

/**
 * Deletes a promotion from Supabase. Explicitly clears dependent junction rows first
 * to ensure deletion succeeds regardless of database cascade configuration.
 */
export async function deleteAdminPromotion(id: string): Promise<{ error: Error | null }> {
  try {
    // 1. Clear any dependent junction records
    await (supabase.from("promotion_products" as any) as any)
      .delete()
      .eq("promotion_id", id);

    // 2. Delete promotion
    const { error } = await (supabase.from("promotions" as any) as any)
      .delete()
      .eq("id", id);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    return {
      error: err instanceof Error ? err : new Error("An unexpected error occurred during deletion"),
    };
  }
}
