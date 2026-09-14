/**
 * ============================================================================
 * NEBA Café — Frontend Data-Fetching Service Layer (src/services/api.ts)
 * ============================================================================
 * Provides typed helper functions to interact with NEBA Café API endpoints
 * and live Supabase database tables with automatic cart product registry sync.
 */

import { registerProduct, registerProducts, type Category, type Product } from "@/lib/menu-data";
import type { Order, OrderStatus } from "@/lib/orders";
import type { Promotion, DiscountType, PromotionStatus } from "@/lib/promotions";
import { DEFAULT_SETTINGS, type NebaSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";

/**
 * Custom error class for API request failures with HTTP status and server error payload.
 */
export class ApiError extends Error {
  public status: number;
  public data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Resolves the base URL for isomorphic fetch (works both in browser and server-side).
 */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  const proc = typeof process !== "undefined" ? process.env : undefined;
  return (
    (import.meta.env["VITE_APP_URL"] as string | undefined) ||
    (proc ? proc["VITE_APP_URL"] : undefined) ||
    "http://localhost:8080"
  );
}

/**
 * Internal generic HTTP request helper with unified error handling and timeout support.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      const errorMessage =
        (typeof errorData === "object" && errorData !== null && "error" in errorData
          ? String((errorData as { error: unknown }).error)
          : null) || `Request failed with status ${response.status} (${response.statusText})`;

      throw new ApiError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Network request timed out", 408);
    }
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFallbackImage(name: string, categorySlug?: string): string {
  const n = name.toLowerCase();
  const cat = (categorySlug || "").toLowerCase();

  if (n.includes("pizza") || cat.includes("pizza")) return "/src/assets/margherita.jpg";
  if (n.includes("chicken") && n.includes("burger")) return "/src/assets/chicken-burger.jpg";
  if (n.includes("cheese") && n.includes("burger")) return "/src/assets/cheese-burger.jpg";
  if (n.includes("burger") || cat.includes("burger")) return "/src/assets/classic-burger.jpg";
  if (n.includes("fries") || n.includes("chip") || cat.includes("side")) return "/src/assets/fries.jpg";
  if (n.includes("sprite")) return "/src/assets/sprite.jpg";
  if (n.includes("water")) return "/src/assets/water.jpg";
  if (n.includes("drink") || n.includes("cola") || cat.includes("drink")) return "/src/assets/cola.jpg";
  return "/src/assets/hero.jpg";
}

/* ==========================================================================
   1. Categories
   ========================================================================== */

/**
 * Fetches all menu categories from API or directly from Supabase.
 */
export async function fetchCategories(): Promise<Category[]> {
  try {
    const data = await request<Category[]>("/api/categories");
    if (data && data.length > 0) return data;
  } catch {
    // Fallback directly to Supabase client
  }

  try {
    const { data, error } = await supabase
      .from("categories" as any)
      .select("id, slug, name, tagline, is_active")
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline || "",
        active: c.is_active ?? true,
      }));
    }
  } catch (err) {
    console.warn("fetchCategories Supabase fallback failed:", err);
  }

  return [];
}

/* ==========================================================================
   2. Products
   ========================================================================== */

export interface FetchProductsOptions {
  category?: string | undefined;
  available?: boolean | undefined;
}

/**
 * Fetches all products with optional category and availability filtering.
 * Automatically registers fetched products into the cart registry.
 */
export async function fetchProducts(options?: FetchProductsOptions): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.category) {
    params.set("category", options.category);
  }
  if (typeof options?.available === "boolean") {
    params.set("available", String(options.available));
  }

  const query = params.toString();

  try {
    const products = await request<Product[]>(`/api/products${query ? `?${query}` : ""}`);
    if (products && products.length > 0) {
      registerProducts(products);
      return products;
    }
  } catch {
    // Fallback directly to Supabase client
  }

  try {
    let queryBuilder = (supabase.from("products" as any) as any)
      .select(`
        id,
        category_id,
        name,
        slug,
        description,
        price,
        image_url,
        is_available,
        is_featured,
        ingredients,
        created_at,
        categories (
          id,
          slug,
          name,
          tagline,
          is_active
        )
      `)
      .order("created_at", { ascending: false });

    if (typeof options?.available === "boolean") {
      queryBuilder = queryBuilder.eq("is_available", options.available);
    }

    const { data, error } = await queryBuilder;

    if (!error && data && data.length > 0) {
      let products: Product[] = data.map((raw: any) => {
        const cat = Array.isArray(raw.categories) ? raw.categories[0] : raw.categories;
        const catSlug = cat?.slug || raw.category_slug || "other";
        const img = raw.image_url?.trim() || getFallbackImage(raw.name, catSlug);
        return {
          id: raw.id,
          name: raw.name,
          slug: raw.slug || raw.id,
          categorySlug: catSlug,
          description: raw.description || "",
          ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : [],
          price: Number(raw.price) || 0,
          image: img,
          available: raw.is_available ?? true,
          featured: raw.is_featured ?? false,
        };
      });

      if (options?.category) {
        products = products.filter((p) => p.categorySlug === options.category);
      }

      registerProducts(products);
      return products;
    }
  } catch (err) {
    console.warn("fetchProducts Supabase fallback failed:", err);
  }

  return [];
}

/**
 * Fetches single product details by ID or URL slug.
 */
export async function fetchProductById(id: string): Promise<Product> {
  try {
    const product = await request<Product>(`/api/products/${encodeURIComponent(id)}`);
    if (product) {
      registerProduct(product);
      return product;
    }
  } catch {
    // Fallback directly to Supabase client
  }

  try {
    const { data, error } = await (supabase.from("products" as any) as any)
      .select(`
        id,
        category_id,
        name,
        slug,
        description,
        price,
        image_url,
        is_available,
        is_featured,
        ingredients,
        categories (
          id,
          slug,
          name,
          tagline,
          is_active
        )
      `)
      .or(`id.eq.${id},slug.eq.${id}`)
      .maybeSingle();

    if (!error && data) {
      const cat = Array.isArray(data.categories) ? data.categories[0] : data.categories;
      const catSlug = cat?.slug || data.category_slug || "other";
      const product: Product = {
        id: data.id,
        name: data.name,
        slug: data.slug || data.id,
        categorySlug: catSlug,
        description: data.description || "",
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        price: Number(data.price) || 0,
        image: data.image_url?.trim() || getFallbackImage(data.name, catSlug),
        available: data.is_available ?? true,
        featured: data.is_featured ?? false,
      };
      registerProduct(product);
      return product;
    }
  } catch (err) {
    console.warn(`fetchProductById Supabase fallback failed for ${id}:`, err);
  }

  throw new ApiError(`Product '${id}' not found`, 404);
}

/**
 * Creates a new product menu item in the persistent database.
 */
export async function createProduct(
  data: Partial<Product> & { name: string; price: number; categoryId?: string },
): Promise<Product> {
  const created = await request<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (created) registerProduct(created);
  return created;
}

/**
 * Updates an existing product's fields (pricing, description, availability, etc.).
 */
export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const updated = await request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (updated) registerProduct(updated);
  return updated;
}

/**
 * Toggles or sets product availability.
 */
export async function toggleAvailability(id: string, targetState?: boolean): Promise<Product> {
  let nextState = targetState;
  if (typeof nextState !== "boolean") {
    const current = await fetchProductById(id);
    nextState = !current.available;
  }
  return updateProduct(id, { available: nextState });
}

/**
 * Deletes a product by ID or slug.
 */
export async function deleteProduct(id: string): Promise<{ success: boolean; deletedId: string }> {
  return request<{ success: boolean; deletedId: string }>(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

/* ==========================================================================
   3. Promotions
   ========================================================================== */

/**
 * Fetches all current promotional offers.
 */
export async function fetchPromotions(): Promise<Promotion[]> {
  try {
    const data = await request<Promotion[]>("/api/promotions");
    if (data && data.length > 0) return data;
  } catch {
    // Fallback directly to Supabase client
  }

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

    if (!error && data && data.length > 0) {
      return data.map((raw: any) => {
        const cat = Array.isArray(raw.categories) ? raw.categories[0] : raw.categories;
        const promoProductsRaw = Array.isArray(raw.promotion_products) ? raw.promotion_products : [];
        const applicableProductIds = promoProductsRaw.map((p: any) => p.product_id).filter(Boolean);

        return {
          id: raw.id,
          name: raw.name || "Promotion",
          description: raw.description || "",
          discountType: (raw.discount_type as DiscountType) || "percentage",
          discountValue: Number(raw.discount_value) || 0,
          applicableProductIds: applicableProductIds.length > 0 ? applicableProductIds : ["*"],
          applicableCategorySlug: cat?.slug || undefined,
          startDate: raw.start_date || "",
          endDate: raw.end_date || "",
          status: (raw.status as PromotionStatus) || "active",
          minOrderAmount: raw.min_order_amount ? Number(raw.min_order_amount) : undefined,
          createdAt: raw.created_at || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn("fetchPromotions Supabase fallback failed:", err);
  }

  return [];
}

/**
 * Updates the promotions list or modifies an existing promotion.
 */
export async function updatePromotions(
  data: Promotion[] | (Partial<Promotion> & { id: string }),
): Promise<Promotion[]> {
  return request<Promotion[]>("/api/promotions", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Creates a new promotion campaign.
 */
export async function createPromotion(
  data: Partial<Promotion> & { name: string; discountValue: number },
): Promise<Promotion> {
  return request<Promotion>("/api/promotions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Deletes a promotion campaign by ID.
 */
export async function deletePromotion(
  id: string,
): Promise<{ success: boolean; deletedId: string }> {
  return request<{ success: boolean; deletedId: string }>(
    `/api/promotions/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

/* ==========================================================================
   4. Settings
   ========================================================================== */

/**
 * Fetches café profile information and operational settings.
 */
export async function fetchSettings(): Promise<NebaSettings> {
  try {
    const data = await request<NebaSettings>("/api/settings");
    if (data) return data;
  } catch {
    // Fallback directly to Supabase client
  }

  try {
    const { data, error } = await (supabase.from("store_settings" as any) as any)
      .select("id, cafe_name, phone, email, address, opening_hours, delivery_fee, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      const parsedFee =
        data.delivery_fee !== undefined && data.delivery_fee !== null
          ? Number(data.delivery_fee)
          : DEFAULT_SETTINGS.deliveryFee;

      return {
        cafeName: data.cafe_name || DEFAULT_SETTINGS.cafeName,
        phone: data.phone || DEFAULT_SETTINGS.phone,
        email: data.email || DEFAULT_SETTINGS.email,
        address: data.address || DEFAULT_SETTINGS.address,
        openingHours: data.opening_hours || DEFAULT_SETTINGS.openingHours,
        deliveryFee: !isNaN(parsedFee) && parsedFee >= 0 ? parsedFee : DEFAULT_SETTINGS.deliveryFee,
        theme: "light",
        showToasts: true,
      };
    }
  } catch (err) {
    console.warn("fetchSettings Supabase fallback failed:", err);
  }

  return { ...DEFAULT_SETTINGS };
}

/**
 * Updates café profile information and settings in the database.
 */
export async function updateSettings(data: Partial<NebaSettings>): Promise<NebaSettings> {
  return request<NebaSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/* ==========================================================================
   5. Orders
   ========================================================================== */

export interface CreateOrderPayload {
  lines: { productId: string; quantity: number }[];
  method: Order["method"];
  customer: Order["customer"];
  paymentMethod: string;
  delivery?: number | undefined;
}

/**
 * Fetches all recorded customer orders.
 */
export async function fetchOrders(): Promise<Order[]> {
  return request<Order[]>("/api/orders");
}

/**
 * Fetches a single order by ID or order number.
 */
export async function fetchOrderById(id: string): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(id)}`);
}

/**
 * Submits a new customer order.
 */
export async function createOrder(orderData: CreateOrderPayload): Promise<Order> {
  return request<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(orderData),
  });
}

/**
 * Updates order status (e.g., 'received', 'preparing', 'ready', 'delivered').
 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
