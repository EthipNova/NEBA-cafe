import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Category, Product } from "@/lib/menu-data";
import type { Order, OrderItem, OrderStatus } from "@/lib/orders";
import type { Promotion, DiscountType, PromotionStatus } from "@/lib/promotions";
import { DEFAULT_SETTINGS, type NebaSettings } from "@/lib/settings";
import { serverSupabase as supabase } from "./supabase";
import { type AboutContent, DEFAULT_ABOUT_CONTENT, normalizeAboutContent } from "@/lib/content";
import { createScopedClient } from "@/lib/supabase";

export interface DatabaseSchema {
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
  settings: NebaSettings;
  orders: Order[];
  about_content?: AboutContent;
}

function resolveDbPath(): string {
  const cwd = process.cwd();
  const directPath = path.resolve(cwd, "data", "db.json");
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  const nestedPath = path.resolve(cwd, "NEBA-cafe-main", "data", "db.json");
  if (fs.existsSync(nestedPath)) {
    return nestedPath;
  }
  return directPath;
}

let writeLock = Promise.resolve();

/**
 * Safely reads the local database file as an offline/network fallback.
 */
export async function readDb(): Promise<DatabaseSchema> {
  const filePath = resolveDbPath();
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [],
      settings:
        parsed.settings && typeof parsed.settings === "object"
          ? (parsed.settings as NebaSettings)
          : { ...DEFAULT_SETTINGS },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      about_content:
        parsed.about_content && typeof parsed.about_content === "object"
          ? normalizeAboutContent(parsed.about_content)
          : { ...DEFAULT_ABOUT_CONTENT },
    };
  } catch {
    return {
      categories: [],
      products: [],
      promotions: [],
      settings: { ...DEFAULT_SETTINGS },
      orders: [],
      about_content: { ...DEFAULT_ABOUT_CONTENT },
    };
  }
}

/**
 * Writes data to data/db.json for offline backup.
 */
export async function writeDb(data: DatabaseSchema): Promise<void> {
  const filePath = resolveDbPath();
  const dir = path.dirname(filePath);

  writeLock = writeLock.then(async () => {
    try {
      await fsp.mkdir(dir, { recursive: true });
      const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      const jsonString = JSON.stringify(data, null, 2);
      await fsp.writeFile(tempPath, jsonString, "utf-8");
      await fsp.rename(tempPath, filePath);
    } catch (err) {
      console.warn("[db] Failed to write local db backup:", err);
    }
  });

  return writeLock;
}

/* ==========================================================================
   Image Helper
   ========================================================================== */

function getProductFallbackImage(name: string, categorySlug?: string): string {
  const n = name.toLowerCase();
  const cat = (categorySlug || "").toLowerCase();

  if (n.includes("pizza") || cat.includes("pizza")) {
    return "/src/assets/margherita.jpg";
  }
  if (n.includes("chicken") && n.includes("burger")) {
    return "/src/assets/chicken-burger.jpg";
  }
  if (n.includes("cheese") && n.includes("burger")) {
    return "/src/assets/cheese-burger.jpg";
  }
  if (n.includes("burger") || cat.includes("burger")) {
    return "/src/assets/classic-burger.jpg";
  }
  if (n.includes("fries") || n.includes("chip") || cat.includes("side")) {
    return "/src/assets/fries.jpg";
  }
  if (n.includes("sprite")) {
    return "/src/assets/sprite.jpg";
  }
  if (n.includes("water")) {
    return "/src/assets/water.jpg";
  }
  if (n.includes("drink") || n.includes("cola") || cat.includes("drink")) {
    return "/src/assets/cola.jpg";
  }
  return "/src/assets/hero.jpg";
}

/* ==========================================================================
   Normalizers
   ========================================================================== */

function normalizeCategory(raw: any): Category {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline || "",
    active: raw.is_active ?? true,
  };
}

function normalizeProduct(raw: any): Product {
  const categoryRaw = Array.isArray(raw?.categories) ? raw.categories[0] : raw?.categories;
  const categorySlug = categoryRaw?.slug || raw.category_slug || "other";
  const rawImage = typeof raw.image_url === "string" ? raw.image_url.trim() : "";
  const image = rawImage || getProductFallbackImage(raw.name, categorySlug);

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || raw.id,
    categorySlug,
    description: raw.description || "",
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : [],
    price: Number(raw.price) || 0,
    image,
    available: raw.is_available ?? true,
    featured: raw.is_featured ?? false,
  };
}

function normalizePromotion(raw: any): Promotion {
  const categoryRaw = Array.isArray(raw?.categories) ? raw.categories[0] : raw?.categories;
  const promoProductsRaw = Array.isArray(raw?.promotion_products) ? raw.promotion_products : [];

  const applicableProductIds: string[] = [];
  const normalizedProducts: any[] = [];

  for (const item of promoProductsRaw) {
    if (item?.product_id) {
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

  return {
    id: raw.id,
    name: raw.name || "Special Promotion",
    description: raw.description || "",
    discountType: (raw.discount_type as DiscountType) || "percentage",
    discountValue: Number(raw.discount_value) || 0,
    applicableProductIds: applicableProductIds.length > 0 ? applicableProductIds : ["*"],
    applicableCategorySlug: categoryRaw?.slug ?? undefined,
    startDate: raw.start_date || "",
    endDate: raw.end_date || "",
    status: (raw.status as PromotionStatus) || "active",
    minOrderAmount: raw.min_order_amount ? Number(raw.min_order_amount) : undefined,
    createdAt: raw.created_at || new Date().toISOString(),
    products: normalizedProducts,
  };
}

function normalizeOrder(raw: any): Order {
  const rawItems = Array.isArray(raw?.order_items) ? raw.order_items : [];
  const items: OrderItem[] = rawItems.map((item: any) => ({
    productId: item.product_id,
    name: item.name || item.products?.name || "Menu Item",
    quantity: Number(item.quantity) || 1,
    price: Number(item.unit_price) || 0,
  }));

  const paymentRaw = Array.isArray(raw?.payments) ? raw.payments[0] : raw?.payments;
  const paymentStatus = paymentRaw?.status || "paid";
  const paymentMethod = paymentRaw?.method || "Mobile Payment";

  return {
    id: raw.id,
    number: raw.order_number,
    createdAt: raw.created_at,
    method: raw.method || "dine-in",
    status: raw.status || "received",
    paymentStatus: paymentStatus === "paid" || paymentStatus === "pending" || paymentStatus === "failed" ? paymentStatus : "paid",
    paymentMethod,
    customer: {
      name: raw.customer_name || "Guest",
      phone: raw.customer_phone || "",
      table: raw.table_number || undefined,
      address: raw.delivery_address || undefined,
    },
    items,
    subtotal: Number(raw.subtotal) || 0,
    discount: Number(raw.discount_amount) || 0,
    delivery: Number(raw.delivery_fee) || 0,
    total: Number(raw.total_amount) || 0,
  };
}

/* ==========================================================================
   Categories (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from("categories" as any)
      .select("id, slug, name, tagline, is_active, created_at")
      .order("name", { ascending: true });

    if (!error && Array.isArray(data)) {
      return data.map(normalizeCategory);
    }
  } catch (err) {
    console.warn("[db] Failed to fetch categories from Supabase, using fallback:", err);
  }

  const local = await readDb();
  return local.categories;
}

/* ==========================================================================
   Products (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getProducts(options?: {
  category?: string | undefined;
  available?: boolean | undefined;
}): Promise<Product[]> {
  try {
    let query = (supabase.from("products" as any) as any)
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
      query = query.eq("is_available", options.available);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      let products = data.map(normalizeProduct);
      if (options?.category) {
        products = products.filter((p: Product) => p.categorySlug === options.category);
      }
      return products;
    }
  } catch (err) {
    console.warn("[db] Failed to fetch products from Supabase, using fallback:", err);
  }

  const local = await readDb();
  let results = local.products;
  if (options?.category) {
    results = results.filter((p) => p.categorySlug === options.category);
  }
  if (typeof options?.available === "boolean") {
    results = results.filter((p) => p.available === options.available);
  }
  return results;
}

export async function getProductById(id: string): Promise<Product | undefined> {
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
      return normalizeProduct(data);
    }
  } catch (err) {
    console.warn(`[db] Failed to fetch product ${id} from Supabase:`, err);
  }

  const local = await readDb();
  return local.products.find((p) => p.id === id || p.slug === id);
}

export async function createProduct(
  input: Partial<Product> & { name: string; price: number; categoryId?: string },
): Promise<Product> {
  const id = input.id || `PROD-${Date.now().toString(36).toUpperCase()}`;
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  try {
    const record = {
      id,
      name: input.name.trim(),
      slug,
      price: input.price,
      description: input.description || "",
      image_url: input.image || "",
      is_available: input.available ?? true,
      is_featured: input.featured ?? false,
      ingredients: input.ingredients || [],
      ...(input.categoryId ? { category_id: input.categoryId } : {}),
    };

    const { data, error } = await (supabase.from("products" as any) as any)
      .insert(record)
      .select("*, categories(*)")
      .single();

    if (!error && data) {
      return normalizeProduct(data);
    }
  } catch (err) {
    console.warn("[db] Supabase createProduct failed, saving to local fallback:", err);
  }

  // Local fallback
  const db = await readDb();
  const newProduct: Product = {
    id,
    name: input.name,
    slug,
    categorySlug: input.categorySlug || "other",
    description: input.description || "",
    ingredients: Array.isArray(input.ingredients) ? input.ingredients : [],
    price: Number(input.price) || 0,
    image: input.image || getProductFallbackImage(input.name, input.categorySlug),
    available: input.available ?? true,
    featured: input.featured ?? false,
  };
  db.products = [newProduct, ...db.products];
  await writeDb(db);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload["name"] = updates.name.trim();
    if (updates.price !== undefined) updatePayload["price"] = updates.price;
    if (updates.description !== undefined) updatePayload["description"] = updates.description.trim();
    if (updates.available !== undefined) updatePayload["is_available"] = updates.available;
    if (updates.featured !== undefined) updatePayload["is_featured"] = updates.featured;
    if (updates.image !== undefined) updatePayload["image_url"] = updates.image.trim();
    if (updates.ingredients !== undefined) updatePayload["ingredients"] = updates.ingredients;

    const { data, error } = await (supabase.from("products" as any) as any)
      .update(updatePayload)
      .or(`id.eq.${id},slug.eq.${id}`)
      .select("*, categories(*)")
      .maybeSingle();

    if (!error && data) {
      return normalizeProduct(data);
    }
  } catch (err) {
    console.warn(`[db] Supabase updateProduct failed for ${id}:`, err);
  }

  // Local fallback
  const db = await readDb();
  const index = db.products.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) return null;

  const current = db.products[index]!;
  const updated: Product = {
    ...current,
    ...updates,
    id: current.id,
  };
  db.products[index] = updated;
  await writeDb(db);
  return updated;
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase.from("products" as any) as any)
      .delete()
      .or(`id.eq.${id},slug.eq.${id}`);

    if (!error) {
      return true;
    }
  } catch (err) {
    console.warn(`[db] Supabase deleteProduct failed for ${id}:`, err);
  }

  const db = await readDb();
  const initialCount = db.products.length;
  db.products = db.products.filter((p) => p.id !== id && p.slug !== id);
  if (db.products.length === initialCount) return false;
  await writeDb(db);
  return true;
}

/* ==========================================================================
   Orders (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getOrders(options?: { phone?: string | undefined }): Promise<Order[]> {
  try {
    const { data, error } = await (supabase.from("orders" as any) as any)
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        method,
        status,
        table_number,
        delivery_address,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        created_at,
        updated_at,
        order_items (
          id,
          order_id,
          product_id,
          name,
          quantity,
          unit_price,
          line_total,
          products (
            id,
            name,
            image_url,
            price
          )
        ),
        payments (
          id,
          order_id,
          method,
          status,
          amount
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      let orders: Order[] = data.map(normalizeOrder);
      if (options?.phone) {
        const p = options.phone.replace(/[\s\-().+]/g, "").slice(-9);
        orders = orders.filter((o: Order) =>
          o.customer.phone.replace(/[\s\-().+]/g, "").includes(p),
        );
      }
      return orders;
    }
    if (error) {
      console.warn("[db] Failed to fetch orders from Supabase:", error.message);
    }
  } catch (err) {
    console.warn("[db] Exception fetching orders from Supabase:", err);
  }

  // Only return empty list on failure — do not silently populate mock orders in production flows
  return [];
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  try {
    const { data, error } = await (supabase.from("orders" as any) as any)
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        method,
        status,
        table_number,
        delivery_address,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        created_at,
        updated_at,
        order_items (
          id,
          order_id,
          product_id,
          name,
          quantity,
          unit_price,
          line_total,
          products (
            id,
            name,
            image_url,
            price
          )
        ),
        payments (
          id,
          order_id,
          method,
          status,
          amount
        )
      `)
      .or(`id.eq.${id},order_number.eq.${id}`)
      .maybeSingle();

    if (!error && data) {
      return normalizeOrder(data);
    }
  } catch (err) {
    console.warn(`[db] Failed to fetch order ${id} from Supabase:`, err);
  }

  const local = await readDb();
  return local.orders.find((o) => o.id === id || o.number === id);
}

export async function createOrder(input: {
  lines: { productId: string; name?: string; quantity: number; price?: number }[];
  method: Order["method"];
  customer: Order["customer"];
  paymentMethod?: string;
  paymentStatus?: "paid" | "pending" | "failed";
  delivery?: number | undefined;
  discount?: number | undefined;
}): Promise<Order> {
  // ── Step A: Resolve product details ────────────────────────────────────────
  const products = await getProducts();
  const items: OrderItem[] = input.lines.flatMap((line) => {
    const product = products.find((p) => p.id === line.productId || p.slug === line.productId);
    const name = line.name || product?.name || "Menu Item";
    const price =
      line.price !== undefined
        ? Number(line.price)
        : product?.price !== undefined
          ? Number(product.price)
          : 0;
    return [
      {
        productId: product?.id || line.productId,
        name,
        quantity: Math.max(1, Number(line.quantity) || 1),
        price,
      },
    ];
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const delivery =
    input.delivery !== undefined
      ? Number(input.delivery)
      : input.method === "delivery"
        ? 90
        : 0;
  const total = Math.max(0, subtotal - discount + delivery);
  const paymentStatus = input.paymentStatus || "paid";
  const paymentMethod = input.paymentMethod || "Mobile Payment";

  const existingOrders = await getOrders();
  const orderNumber = `#${1000 + (existingOrders.length % 900) + Math.floor(Math.random() * 90)}`;
  const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const customerPhone = input.customer?.phone?.trim() || "";
  const customerName =
    input.customer?.name?.trim() || (input.method === "dine-in" ? "Dine-in Guest" : "Guest");

  // ── Step B: Find or create customer profile ────────────────────────────────
  // Always attempts find-or-create so that orders.customer_id is never null
  // for identifiable customers (phone OR named dine-in guests).
  //
  // Identity resolution order:
  //   1. Phone (primary key — normalised to strip spaces/+251 prefix)
  //   2. Name  (fallback for anonymous dine-in with no phone provided)
  //
  // Skipped only for truly anonymous orders: no phone AND name is a generic
  // placeholder ("Guest", "Dine-in Guest").
  let customerId: string | null = null;

  // Normalise phone for consistent deduplication across +251/09/251 formats
  const normPhone = customerPhone
    ? customerPhone.replace(/[\s\-().]/g, "").replace(/^\+251/, "0").replace(/^251/, "0")
    : "";

  const isAnonymous =
    !normPhone &&
    (!customerName ||
      customerName.toLowerCase() === "guest" ||
      customerName.toLowerCase() === "dine-in guest");

  if (!isAnonymous) {
    try {
      // ── B1: Lookup by normalised phone first ──────────────────────────────
      let existingId: string | null = null;

      if (normPhone) {
        // Try exact stored phone match and also the normalised variant
        const { data: byPhone } = await (supabase.from("customers" as any) as any)
          .select("id")
          .or(`phone.eq.${customerPhone},phone.eq.${normPhone}`)
          .maybeSingle();
        if (byPhone?.id) {
          existingId = byPhone.id;
        }
      }

      // ── B2: Fallback – lookup by name when no phone and not anonymous ─────
      if (!existingId && !normPhone && customerName) {
        const { data: byName } = await (supabase.from("customers" as any) as any)
          .select("id")
          .ilike("name", customerName.trim())
          .maybeSingle();
        if (byName?.id) {
          existingId = byName.id;
        }
      }

      if (existingId) {
        // Found — reuse existing customer; optionally refresh name
        customerId = existingId;
        // Update name if it changed (non-fatal)
        await (supabase.from("customers" as any) as any)
          .update({ name: customerName, updated_at: nowIso })
          .eq("id", existingId);
      } else {
        // ── B3: Create new customer record ──────────────────────────────────
        // customers.id is type uuid — must use a proper UUID v4
        const newCustId = crypto.randomUUID();
        const { data: createdCust, error: custErr } = await (supabase.from("customers" as any) as any)
          .insert({
            id: newCustId,
            name: customerName,
            // Store the original phone value; normalised version used only for lookup
            phone: normPhone || null,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("id")
          .maybeSingle();

        if (!custErr && createdCust?.id) {
          customerId = createdCust.id;
          console.log(`[db] New customer created: ${customerName} (${customerId})`);
        } else if (custErr) {
          // Log clearly — still non-fatal so the order itself is not lost
          console.error(
            `[db] Customer create failed (code ${custErr.code}): ${custErr.message}` +
            (custErr.code === "42501"
              ? " >> Add SUPABASE_SERVICE_ROLE_KEY to .env or run supabase/policies.sql"
              : ""),
          );
        }
      }
    } catch (custEx) {
      console.error("[db] Customer find-or-create error (non-fatal, order will proceed):", custEx);
    }
  }

  // ── Step C: Insert the order row (FATAL if this fails) ─────────────────────
  const orderRecord = {
    id: orderId,
    order_number: orderNumber,
    customer_id: customerId,
    customer_name: customerName,
    customer_phone: customerPhone,
    method: input.method,
    status: "received",
    table_number: input.customer?.table || null,
    delivery_address: input.customer?.address || null,
    subtotal,
    discount_amount: discount,
    delivery_fee: delivery,
    total_amount: total,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { error: ordErr } = await (supabase.from("orders" as any) as any).insert(orderRecord);

  if (ordErr) {
    // Emit a clear, actionable error message.
    const is42501 = ordErr.code === "42501";
    const hint = is42501
      ? "\n  >> RLS is blocking the insert. Either:\n" +
        "     (a) Add SUPABASE_SERVICE_ROLE_KEY to your .env file (get it from Supabase\n" +
        "         Dashboard -> Project Settings -> API -> service_role), OR\n" +
        "     (b) Run supabase/policies.sql in the Supabase SQL Editor to allow anon inserts."
      : "";
    console.error(`[db] Supabase order insert error (code ${ordErr.code}):`, ordErr.message, hint);
    throw new Error(
      `Failed to save order to database: ${ordErr.message || String(ordErr)}` +
      (is42501 ? " (RLS policy violation -- see server logs for fix instructions)" : ""),
    );
  }

  // ── Step D: Insert order items (non-fatal individually, logged clearly) ─────
  if (items.length > 0) {
    // Build a set of Supabase product IDs for FK validation.
    // products[] was already fetched from Supabase in Step A.
    // Any product whose ID starts with "p-" (local-only mock IDs) is not in
    // Supabase's products table and must be stored with product_id = null to
    // avoid violating the fk_order_items_product foreign key constraint.
    const supabaseProductIds = new Set(products.map((p) => p.id));

    const itemRecords = items.map((it) => ({
      order_id: orderId,
      // Only set product_id if the product actually exists in Supabase
      product_id: supabaseProductIds.has(it.productId) ? it.productId : null,
      name: it.name,
      quantity: it.quantity,
      unit_price: it.price,
      line_total: it.price * it.quantity,
    }));
    const { error: itemsErr } = await (supabase.from("order_items" as any) as any).insert(itemRecords);
    if (itemsErr) {
      // Log clearly but don't throw — the order row already exists.
      console.error(
        `[db] order_items insert failed (code ${itemsErr.code}): ${itemsErr.message}`,
        itemsErr.code === "42501"
          ? ">> Apply supabase/policies.sql or use service-role key."
          : "",
      );
    }
  }

  // ── Step E: Insert payment record (non-fatal, logged clearly) ───────────────
  const { error: payErr } = await (supabase.from("payments" as any) as any).insert({
    order_id: orderId,
    method: paymentMethod,
    status: paymentStatus,
    amount: total,
    paid_at: paymentStatus === "paid" ? nowIso : null,
    created_at: nowIso,
  });
  if (payErr) {
    console.error(
      `[db] payments insert failed (code ${payErr.code}): ${payErr.message}`,
      payErr.code === "42501"
        ? ">> Apply supabase/policies.sql or use service-role key."
        : "",
    );
  }

  // ── Step F: Fetch the persisted order for a canonical response ───────────────
  const created = await getOrderById(orderId);
  if (created) return created;

  // Fallback: return a synthesized Order object if the SELECT fails
  return {
    id: orderId,
    number: orderNumber,
    createdAt: nowIso,
    method: input.method,
    status: "received",
    paymentStatus,
    paymentMethod,
    customer: {
      name: customerName,
      phone: customerPhone,
      ...(input.customer?.table ? { table: input.customer.table } : {}),
      ...(input.customer?.address ? { address: input.customer.address } : {}),
    },
    items,
    subtotal,
    discount,
    delivery,
    total,
  };
}

/* ==========================================================================
   Customers (server-side, service-role client — never exposes data to browser)
   ========================================================================== */

/**
 * Raw customer row shape returned by Supabase for the customers table.
 * Defines only the columns that actually exist in the schema.
 */
export interface RawCustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  orders?: RawCustomerOrderRow[];
  customer_addresses?: RawCustomerAddressRow[];
}

interface RawCustomerOrderRow {
  id: string;
  order_number: string | null;
  method: string | null;
  status: string | null;
  table_number: string | null;
  delivery_address: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  delivery_fee: number | null;
  total_amount: number | null;
  created_at: string;
  updated_at: string | null;
  order_items?: RawOrderItemRow[];
  payments?: RawPaymentRow[];
}

interface RawOrderItemRow {
  id: string;
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
}

interface RawPaymentRow {
  id: string;
  status: string | null;
  method: string | null;
  amount: number | null;
  created_at: string;
}

interface RawCustomerAddressRow {
  id: string;
  address_line: string | null;
  is_default: boolean | null;
  created_at: string;
}

/**
 * Fetches all customer profiles with their full order history from Supabase
 * using the server-side service-role client (bypasses RLS).
 * This function runs on the server only — never called from the browser.
 */
export async function getCustomers(): Promise<RawCustomerRow[]> {
  try {
    const { data, error } = await (supabase.from("customers" as any) as any)
      .select(`
        id,
        name,
        phone,
        email,
        created_at,
        updated_at,
        orders (
          id,
          order_number,
          method,
          status,
          table_number,
          delivery_address,
          subtotal,
          discount_amount,
          delivery_fee,
          total_amount,
          created_at,
          updated_at,
          order_items (
            id,
            name,
            quantity,
            unit_price,
            line_total
          ),
          payments (
            id,
            status,
            method,
            amount,
            created_at
          )
        ),
        customer_addresses (
          id,
          address_line,
          is_default,
          created_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[db] getCustomers Supabase error:", error.message);
      return [];
    }

    return Array.isArray(data) ? (data as RawCustomerRow[]) : [];
  } catch (err) {
    console.error("[db] getCustomers exception:", err);
    return [];
  }
}

export async function updateOrderStatus(
  idOrNumber: string,
  status: OrderStatus,
): Promise<Order | null> {
  // Always update in local fallback DB first so it is immediately reflected
  const db = await readDb();
  const orderIndex = db.orders.findIndex((o) => o.id === idOrNumber || o.number === idOrNumber);
  let localUpdated: Order | null = null;
  if (orderIndex !== -1) {
    db.orders[orderIndex]!.status = status;
    localUpdated = db.orders[orderIndex]!;
    await writeDb(db);
  }

  // Also update in Supabase if present
  try {
    const { error, data } = await (supabase.from("orders" as any) as any)
      .update({ status, updated_at: new Date().toISOString() })
      .or(`id.eq.${idOrNumber},order_number.eq.${idOrNumber}`)
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        method,
        status,
        table_number,
        delivery_address,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        created_at,
        updated_at,
        order_items (
          id,
          order_id,
          product_id,
          name,
          quantity,
          unit_price,
          line_total,
          products (
            id,
            name,
            image_url,
            price
          )
        ),
        payments (
          id,
          order_id,
          method,
          status,
          amount
        )
      `);

    if (!error && data && data.length > 0) {
      return normalizeOrder(data[0]);
    }
  } catch (err) {
    console.warn(`[db] Failed to update order status in Supabase for ${idOrNumber}:`, err);
  }

  return localUpdated;
}

export async function updateOrderPayment(
  idOrNumber: string,
  input: {
    paymentStatus: "paid" | "pending" | "failed";
    paymentMethod?: string;
    transactionReference?: string | null;
  },
): Promise<Order | null> {
  const db = await readDb();
  const orderIndex = db.orders.findIndex((o) => o.id === idOrNumber || o.number === idOrNumber);
  let localUpdated: Order | null = null;
  if (orderIndex !== -1) {
    db.orders[orderIndex]!.paymentStatus = input.paymentStatus;
    if (input.paymentMethod) {
      db.orders[orderIndex]!.paymentMethod = input.paymentMethod;
    }
    localUpdated = db.orders[orderIndex]!;
    await writeDb(db);
  }

  try {
    const order = await getOrderById(idOrNumber);
    if (order) {
      const nowIso = new Date().toISOString();
      const paymentUpdate: any = {
        status: input.paymentStatus,
        updated_at: nowIso,
      };
      if (input.paymentMethod) paymentUpdate.method = input.paymentMethod;
      if (input.transactionReference !== undefined) {
        paymentUpdate.transaction_reference = input.transactionReference;
      }
      if (input.paymentStatus === "paid") {
        paymentUpdate.paid_at = nowIso;
      }

      await (supabase.from("payments" as any) as any)
        .update(paymentUpdate)
        .eq("order_id", order.id);

      await (supabase.from("orders" as any) as any)
        .update({ updated_at: nowIso })
        .eq("id", order.id);

      const refreshed = await getOrderById(order.id);
      if (refreshed) return refreshed;
    }
  } catch (err) {
    console.warn(`[db] Failed to update order payment in Supabase for ${idOrNumber}:`, err);
  }

  return localUpdated;
}

/* ==========================================================================
   Promotions (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getPromotions(): Promise<Promotion[]> {
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
      return data.map(normalizePromotion);
    }
  } catch (err) {
    console.warn("[db] Failed to fetch promotions from Supabase:", err);
  }

  const local = await readDb();
  return local.promotions;
}

export async function updatePromotions(promotions: Promotion[]): Promise<Promotion[]> {
  const db = await readDb();
  db.promotions = promotions;
  await writeDb(db);
  return db.promotions;
}

export async function createPromotion(promo: Promotion): Promise<Promotion> {
  try {
    const { data, error } = await (supabase.from("promotions" as any) as any)
      .insert({
        name: promo.name,
        description: promo.description,
        discount_type: promo.discountType,
        discount_value: promo.discountValue,
        start_date: promo.startDate,
        end_date: promo.endDate,
        status: promo.status || "active",
        min_order_amount: promo.minOrderAmount || null,
      })
      .select("*, categories(*)")
      .single();

    if (!error && data) {
      return normalizePromotion(data);
    }
  } catch (err) {
    console.warn("[db] Failed to insert promotion to Supabase:", err);
  }

  const db = await readDb();
  db.promotions = [promo, ...db.promotions];
  await writeDb(db);
  return promo;
}

export async function deletePromotion(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase.from("promotions" as any) as any)
      .delete()
      .eq("id", id);
    if (!error) return true;
  } catch (err) {
    console.warn(`[db] Failed to delete promotion ${id} from Supabase:`, err);
  }

  const db = await readDb();
  const initialCount = db.promotions.length;
  db.promotions = db.promotions.filter((p) => p.id !== id);
  if (db.promotions.length === initialCount) return false;
  await writeDb(db);
  return true;
}

/* ==========================================================================
   Store Settings (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getSettings(): Promise<NebaSettings> {
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
    console.warn("[db] Failed to fetch store settings from Supabase:", err);
  }

  const local = await readDb();
  return local.settings;
}

export async function updateSettings(updates: Partial<NebaSettings>): Promise<NebaSettings> {
  try {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.cafeName !== undefined) payload["cafe_name"] = updates.cafeName.trim();
    if (updates.phone !== undefined) payload["phone"] = updates.phone.trim();
    if (updates.email !== undefined) payload["email"] = updates.email.trim();
    if (updates.address !== undefined) payload["address"] = updates.address.trim();
    if (updates.openingHours !== undefined) payload["opening_hours"] = updates.openingHours.trim();
    if (updates.deliveryFee !== undefined) payload["delivery_fee"] = Number(updates.deliveryFee);

    const { data, error } = await (supabase.from("store_settings" as any) as any)
      .update(payload)
      .eq("id", 1)
      .select()
      .maybeSingle();

    if (!error && data) {
      return getSettings();
    }
  } catch (err) {
    console.warn("[db] Failed to update store settings in Supabase:", err);
  }

  const db = await readDb();
  db.settings = {
    ...db.settings,
    ...updates,
  };
  await writeDb(db);
  return db.settings;
}

/* ==========================================================================
   6. Website Content (Live Supabase with Local Fallback)
   ========================================================================== */

export async function getAboutContent(): Promise<AboutContent> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("about_content" as any) as any)
      .select(
        "id, homepage_hero_image, about_hero_image, about_title, about_description, story_title, story_content, story_image, value_1_title, value_1_description, value_2_title, value_2_description, value_3_title, value_3_description, updated_at",
      )
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return normalizeAboutContent(data);
    }
  } catch (err) {
    console.warn("[db] Failed to fetch about content from Supabase:", err);
  }

  try {
    const local = await readDb();
    if (local.about_content) {
      return normalizeAboutContent(local.about_content);
    }
  } catch (err) {
    console.warn("[db] Failed to read local db.json for about content:", err);
  }

  return { ...DEFAULT_ABOUT_CONTENT };
}

export async function updateAboutContent(
  updates: Partial<AboutContent>,
  token?: string,
): Promise<AboutContent> {
  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    updated_at: nowIso,
  };

  if (updates.homepage_hero_image !== undefined)
    payload["homepage_hero_image"] = updates.homepage_hero_image;
  if (updates.about_hero_image !== undefined)
    payload["about_hero_image"] = updates.about_hero_image;
  if (updates.about_title !== undefined) payload["about_title"] = updates.about_title.trim();
  if (updates.about_description !== undefined)
    payload["about_description"] = updates.about_description.trim();
  if (updates.story_title !== undefined) payload["story_title"] = updates.story_title.trim();
  if (updates.story_content !== undefined) payload["story_content"] = updates.story_content.trim();
  if (updates.story_image !== undefined) payload["story_image"] = updates.story_image;
  if (updates.value_1_title !== undefined) payload["value_1_title"] = updates.value_1_title.trim();
  if (updates.value_1_description !== undefined)
    payload["value_1_description"] = updates.value_1_description.trim();
  if (updates.value_2_title !== undefined) payload["value_2_title"] = updates.value_2_title.trim();
  if (updates.value_2_description !== undefined)
    payload["value_2_description"] = updates.value_2_description.trim();
  if (updates.value_3_title !== undefined) payload["value_3_title"] = updates.value_3_title.trim();
  if (updates.value_3_description !== undefined)
    payload["value_3_description"] = updates.value_3_description.trim();

  try {
    const client = token ? createScopedClient(token) : supabase;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from("about_content" as any) as any)
      .update(payload)
      .eq("id", 1)
      .select()
      .maybeSingle();

    if (!error && data) {
      try {
        const db = await readDb();
        db.about_content = normalizeAboutContent({
          ...(db.about_content || DEFAULT_ABOUT_CONTENT),
          ...payload,
        });
        await writeDb(db);
      } catch {
        // ignore local mirror errors if Supabase succeeded
      }
      return normalizeAboutContent(data);
    }
    if (error) {
      console.warn("[db] Supabase about_content update returned error:", error.message);
      if (token) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    }
  } catch (err) {
    console.warn("[db] Failed to update about content in Supabase:", err);
    if (token) {
      throw err;
    }
  }

  // Fallback to local db.json
  const db = await readDb();
  db.about_content = normalizeAboutContent({
    ...(db.about_content || DEFAULT_ABOUT_CONTENT),
    ...payload,
  });
  await writeDb(db);
  return db.about_content;
}
