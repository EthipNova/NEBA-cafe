import {
  createOrder,
  createProduct,
  createPromotion,
  deleteProduct,
  deletePromotion,
  getAboutContent,
  getCategories,
  getCustomers,
  getOrderById,
  getOrders,
  getProductById,
  getProducts,
  getPromotions,
  getSettings,
  updateOrderPayment,
  updateAboutContent,
  updateOrderStatus,
  updateProduct,
  updatePromotions,
  updateSettings,
} from "./db";
import type { AboutContent } from "@/lib/content";
import type { Order, OrderStatus } from "@/lib/orders";
import type { Promotion } from "@/lib/promotions";
import { createScopedClient, supabase } from "@/lib/supabase";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function badRequest(message: string): Response {
  return json({ error: "Bad Request", message }, 400);
}

function notFound(message = "Resource not found"): Response {
  return json({ error: "Not Found", message }, 404);
}

function serverError(error: unknown): Response {
  console.error("[api] Unhandled server error:", error);
  const message = error instanceof Error ? error.message : "Internal Server Error";
  return json({ error: "Internal Server Error", message }, 500);
}

/**
 * Validates the request bearer token against Supabase Auth and checks for ADMIN role in public.users
 * using a token-scoped client to satisfy PostgREST Row-Level Security.
 * Returns the verified token if authorized, or null if unauthorized.
 */
async function verifyAdminUser(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return null;

    const scopedClient = createScopedClient(token);
    const { data: profile, error: profError } = await scopedClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profError || !profile) return null;
    return profile.role === "ADMIN" ? token : null;
  } catch (err) {
    console.warn("[api] Admin verification failed:", err);
    return null;
  }
}

/**
 * Main HTTP router for /api/* requests.
 */
export async function handleApiRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  try {
    /* ----------------------------------------------------------------------
       1. Categories: GET /api/categories
       ---------------------------------------------------------------------- */
    if (pathname === "/api/categories") {
      if (method === "GET") {
        const categories = await getCategories();
        return json(categories);
      }
      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       1b. Customers: GET /api/customers
       Returns every customer with their full order history.
       Runs server-side through serverSupabase (service-role key) so the
       browser never needs direct Supabase access for admin customer data.
       ---------------------------------------------------------------------- */
    if (pathname === "/api/customers") {
      if (method === "GET") {
        const customers = await getCustomers();
        return json(customers);
      }
      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       2. Products:
          GET    /api/products
          POST   /api/products
          GET    /api/products/:id
          PUT    /api/products/:id
          PATCH  /api/products/:id
          DELETE /api/products/:id
       ---------------------------------------------------------------------- */
    if (pathname === "/api/products") {
      if (method === "GET") {
        const category = url.searchParams.get("category") || undefined;
        const availableParam = url.searchParams.get("available");
        const available = availableParam !== null ? availableParam === "true" : undefined;
        const products = await getProducts({ category, available });
        return json(products);
      }

      if (method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || !body.name || body.price === undefined) {
          return badRequest("Missing required fields: 'name' and 'price'");
        }
        const created = await createProduct(body);
        return json(created, 201);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch) {
      const productId = decodeURIComponent(productMatch[1]!);

      if (method === "GET") {
        const product = await getProductById(productId);
        if (!product) return notFound(`Product '${productId}' not found`);
        return json(product);
      }

      if (method === "PUT" || method === "PATCH") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return badRequest("Invalid JSON body");
        }
        const updated = await updateProduct(productId, body);
        if (!updated) return notFound(`Product '${productId}' not found`);
        return json(updated);
      }

      if (method === "DELETE") {
        const deleted = await deleteProduct(productId);
        if (!deleted) return notFound(`Product '${productId}' not found`);
        return json({ success: true, deletedId: productId });
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       3. Orders:
          GET   /api/orders
          POST  /api/orders
          GET   /api/orders/:id
          PATCH /api/orders/:id
          PUT   /api/orders/:id
       ---------------------------------------------------------------------- */
    if (pathname === "/api/orders") {
      if (method === "GET") {
        const phone = url.searchParams.get("phone") || undefined;
        const orders = await getOrders(phone ? { phone } : undefined);
        return json(orders);
      }

      if (method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || !Array.isArray(body.lines) || !body.method) {
          return badRequest("Invalid order data. 'lines' array and 'method' are required.");
        }
        const created = await createOrder(body);
        return json(created, 201);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    const orderPaymentMatch = pathname.match(/^\/api\/orders\/([^/]+)\/payment$/);
    if (orderPaymentMatch) {
      const orderId = decodeURIComponent(orderPaymentMatch[1]!);
      if (method === "PATCH" || method === "POST" || method === "PUT") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || !body.paymentStatus) {
          return badRequest("Field 'paymentStatus' ('paid', 'pending', or 'failed') is required.");
        }
        const updated = await updateOrderPayment(orderId, {
          paymentStatus: body.paymentStatus,
          paymentMethod: body.paymentMethod,
          transactionReference: body.transactionReference,
        });
        if (!updated) return notFound(`Order '${orderId}' not found`);
        return json(updated);
      }
      return json({ error: "Method Not Allowed" }, 405);
    }

    const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch) {
      const orderId = decodeURIComponent(orderMatch[1]!);

      if (method === "GET") {
        const order = await getOrderById(orderId);
        if (!order) return notFound(`Order '${orderId}' not found`);
        return json(order);
      }

      if (method === "PATCH" || method === "PUT") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return badRequest("Invalid request body");
        }

        let updated: Order | null = null;
        if (body.status) {
          updated = await updateOrderStatus(orderId, body.status as OrderStatus);
        }
        if (body.paymentStatus) {
          updated = await updateOrderPayment(orderId, {
            paymentStatus: body.paymentStatus,
            paymentMethod: body.paymentMethod,
            transactionReference: body.transactionReference,
          });
        }
        if (!body.status && !body.paymentStatus) {
          return badRequest("Field 'status' or 'paymentStatus' is required to update order.");
        }

        if (!updated) return notFound(`Order '${orderId}' not found`);
        return json(updated);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       4. Promotions:
          GET  /api/promotions
          PUT  /api/promotions
          POST /api/promotions
       ---------------------------------------------------------------------- */
    if (pathname === "/api/promotions") {
      if (method === "GET") {
        const promotions = await getPromotions();
        return json(promotions);
      }

      if (method === "PUT") {
        const body = await request.json().catch(() => null);
        if (Array.isArray(body)) {
          const updated = await updatePromotions(body as Promotion[]);
          return json(updated);
        }
        if (body && typeof body === "object" && body.id) {
          const existing = await getPromotions();
          const next = existing.map((p) => (p.id === body.id ? { ...p, ...body } : p));
          const updated = await updatePromotions(next);
          return json(updated);
        }
        return badRequest("Expected an array of promotions or a promotion object with an 'id'");
      }

      if (method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || !body.name || body.discountValue === undefined) {
          return badRequest("Missing required fields: 'name' and 'discountValue'");
        }
        const newPromo: Promotion = {
          id: body.id || `promo-${Date.now().toString(36)}`,
          name: body.name,
          description: body.description || "",
          discountType: body.discountType || "percentage",
          discountValue: Number(body.discountValue) || 0,
          applicableProductIds: Array.isArray(body.applicableProductIds)
            ? body.applicableProductIds
            : ["*"],
          applicableCategorySlug: body.applicableCategorySlug,
          startDate: body.startDate || new Date().toISOString().split("T")[0]!,
          endDate: body.endDate || "2099-12-31",
          status: body.status || "active",
          minOrderAmount: body.minOrderAmount,
          createdAt: new Date().toISOString(),
        };
        const created = await createPromotion(newPromo);
        return json(created, 201);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    const promoMatch = pathname.match(/^\/api\/promotions\/([^/]+)$/);
    if (promoMatch) {
      const promoId = decodeURIComponent(promoMatch[1]!);
      if (method === "DELETE") {
        const deleted = await deletePromotion(promoId);
        if (!deleted) return notFound(`Promotion '${promoId}' not found`);
        return json({ success: true, deletedId: promoId });
      }
      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       5. Settings:
          GET /api/settings
          PUT /api/settings
       ---------------------------------------------------------------------- */
    if (pathname === "/api/settings") {
      if (method === "GET") {
        const settings = await getSettings();
        return json(settings);
      }

      if (method === "PUT" || method === "PATCH") {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return badRequest("Invalid JSON body");
        }
        const updated = await updateSettings(body);
        return json(updated);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    /* ----------------------------------------------------------------------
       6. Website Content:
          GET /api/content
          PUT /api/content
       ---------------------------------------------------------------------- */
    if (pathname === "/api/content") {
      if (method === "GET") {
        const content = await getAboutContent();
        return json(content);
      }

      if (method === "PUT" || method === "PATCH") {
        const token = await verifyAdminUser(request);
        if (!token) {
          return json(
            { error: "Forbidden", message: "Only administrators can update website content." },
            403,
          );
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return badRequest("Invalid JSON body");
        }

        // Sanitize payload to ONLY allowed editable fields (protect id and updated_at)
        const allowedUpdates: Partial<AboutContent> = {};
        if (body.homepage_hero_image !== undefined)
          allowedUpdates.homepage_hero_image = body.homepage_hero_image;
        if (body.about_hero_image !== undefined)
          allowedUpdates.about_hero_image = body.about_hero_image;
        if (typeof body.about_title === "string") allowedUpdates.about_title = body.about_title;
        if (typeof body.about_description === "string")
          allowedUpdates.about_description = body.about_description;
        if (typeof body.story_title === "string") allowedUpdates.story_title = body.story_title;
        if (typeof body.story_content === "string")
          allowedUpdates.story_content = body.story_content;
        if (body.story_image !== undefined) allowedUpdates.story_image = body.story_image;
        if (typeof body.value_1_title === "string")
          allowedUpdates.value_1_title = body.value_1_title;
        if (typeof body.value_1_description === "string")
          allowedUpdates.value_1_description = body.value_1_description;
        if (typeof body.value_2_title === "string")
          allowedUpdates.value_2_title = body.value_2_title;
        if (typeof body.value_2_description === "string")
          allowedUpdates.value_2_description = body.value_2_description;
        if (typeof body.value_3_title === "string")
          allowedUpdates.value_3_title = body.value_3_title;
        if (typeof body.value_3_description === "string")
          allowedUpdates.value_3_description = body.value_3_description;

        const updated = await updateAboutContent(allowedUpdates, token);
        return json(updated);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

    return notFound(`Endpoint '${pathname}' not found`);
  } catch (error) {
    return serverError(error);
  }
}
