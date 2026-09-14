import {
  createOrder,
  createProduct,
  createPromotion,
  deleteProduct,
  deletePromotion,
  getCategories,
  getOrderById,
  getOrders,
  getProductById,
  getProducts,
  getPromotions,
  getSettings,
  updateOrderStatus,
  updateProduct,
  updatePromotions,
  updateSettings,
} from "./db";
import type { OrderStatus } from "@/lib/orders";
import type { Promotion } from "@/lib/promotions";

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
        const orders = await getOrders();
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
        if (!body || typeof body !== "object" || !body.status) {
          return badRequest("Field 'status' is required to update order status.");
        }
        const updated = await updateOrderStatus(orderId, body.status as OrderStatus);
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
          applicableProductIds: Array.isArray(body.applicableProductIds) ? body.applicableProductIds : ["*"],
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

    return notFound(`Endpoint '${pathname}' not found`);
  } catch (error) {
    return serverError(error);
  }
}
