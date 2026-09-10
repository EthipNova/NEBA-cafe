import type { Order, OrderMethod, OrderStatus } from "./orders";

export type DerivedCustomer = {
  id: string;
  name: string;
  phone: string;
  rawPhone: string;
  orderCount: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  lastOrderStatus: OrderStatus;
  preferredMethod: OrderMethod;
  orders: Order[];
  tables: string[];
  addresses: string[];
  isReturning: boolean;
  isRecent: boolean;
};

/**
 * Normalizes phone numbers for reliable deduplication across orders.
 * Handles local Ethiopia prefixes (09..., +251..., 251...) and whitespace/hyphens.
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[\s\-().]/g, "").trim();
  if (cleaned.startsWith("+251")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("251")) {
    cleaned = "0" + cleaned.slice(3);
  }
  return cleaned;
}

/**
 * Partially masks phone numbers for list display to adhere to privacy practices.
 * e.g. "0911234567" -> "09••••••67".
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || phone === "Not provided" || phone.trim() === "") {
    return "Not provided";
  }
  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  const start = trimmed.slice(0, 2);
  const end = trimmed.slice(-2);
  return `${start}••••••${end}`;
}

/**
 * Determines whether a customer order is recent (within the last 30 days).
 */
export function isRecentCustomer(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - time <= thirtyDaysMs;
}

/**
 * Formats relative dates (e.g., Today, Yesterday, 3 days ago, or Oct 12).
 */
export function formatCustomerRelativeDate(dateStr?: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Formats full timestamp for customer details and history cards.
 */
export function formatCustomerFullDateTime(dateStr?: string | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Calculates the preferred fulfillment method across a set of customer orders.
 */
export function derivePreferredMethod(orders: Order[]): OrderMethod {
  if (!orders.length) return "dine-in";
  const counts: Record<OrderMethod, number> = {
    "dine-in": 0,
    takeaway: 0,
    delivery: 0,
  };

  for (const o of orders) {
    if (o && o.method && o.method in counts) {
      counts[o.method]++;
    }
  }

  let topMethod: OrderMethod = orders[0]?.method || "dine-in";
  let maxCount = -1;

  for (const method of ["dine-in", "takeaway", "delivery"] as const) {
    if (counts[method] > maxCount) {
      maxCount = counts[method];
      topMethod = method;
    }
  }

  return topMethod;
}

/**
 * Pure aggregation function: Groups raw orders from neba.orders.v1 into unique
 * customer records without persisting any secondary customer database.
 */
export function aggregateCustomers(orders: Order[]): DerivedCustomer[] {
  if (!Array.isArray(orders) || orders.length === 0) {
    return [];
  }

  const groups = new Map<string, Order[]>();

  for (const order of orders) {
    if (!order || typeof order !== "object") continue;

    const rawPhone = order.customer?.phone;
    const normalized = normalizePhone(rawPhone);
    const rawName = order.customer?.name?.trim();

    let groupKey: string;
    if (normalized.length > 0) {
      groupKey = `phone:${normalized}`;
    } else if (
      rawName &&
      rawName.toLowerCase() !== "dine-in guest" &&
      rawName.toLowerCase() !== "guest diner"
    ) {
      groupKey = `name:${rawName.toLowerCase()}`;
    } else {
      groupKey = `order:${order.id || order.number || Math.random().toString(36)}`;
    }

    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(order);
    } else {
      groups.set(groupKey, [order]);
    }
  }

  const customers: DerivedCustomer[] = [];

  for (const [id, customerOrders] of groups.entries()) {
    // Sort customer's orders newest first
    const sortedOrders = [...customerOrders].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime() || 0;
      const timeB = new Date(b.createdAt || 0).getTime() || 0;
      return timeB - timeA;
    });

    // Pick latest non-empty name
    let name = "Customer";
    for (const o of sortedOrders) {
      const n = o.customer?.name?.trim();
      if (n && n.toLowerCase() !== "dine-in guest" && n.toLowerCase() !== "guest diner") {
        name = n;
        break;
      }
    }
    if (name === "Customer") {
      for (const o of sortedOrders) {
        const n = o.customer?.name?.trim();
        if (n) {
          name = n;
          break;
        }
      }
    }

    // Pick latest non-empty phone
    let phone = "Not provided";
    let rawPhone = "";
    for (const o of sortedOrders) {
      const p = o.customer?.phone?.trim();
      if (p) {
        phone = p;
        rawPhone = p;
        break;
      }
    }

    // Total spending
    const totalSpent = sortedOrders.reduce((sum, o) => {
      const val = typeof o.total === "number" && !isNaN(o.total) ? o.total : 0;
      return sum + val;
    }, 0);

    // Dates
    const lastOrder = sortedOrders[0];
    const firstOrder = sortedOrders[sortedOrders.length - 1];
    const lastOrderDate = lastOrder?.createdAt || new Date().toISOString();
    const firstOrderDate = firstOrder?.createdAt || lastOrderDate;
    const lastOrderStatus = lastOrder?.status || "received";

    // Preferred fulfillment method
    const preferredMethod = derivePreferredMethod(sortedOrders);

    // Known tables
    const tables = Array.from(
      new Set(
        sortedOrders
          .map((o) => o.customer?.table)
          .filter((t): t is string => Boolean(t && t.trim())),
      ),
    );

    // Known delivery addresses
    const addresses = Array.from(
      new Set(
        sortedOrders
          .map((o) => o.customer?.address)
          .filter((a): a is string => Boolean(a && a.trim())),
      ),
    );

    const isReturning = sortedOrders.length > 1;
    const isRecent = isRecentCustomer(lastOrderDate);

    customers.push({
      id,
      name,
      phone,
      rawPhone,
      orderCount: sortedOrders.length,
      totalSpent,
      firstOrderDate,
      lastOrderDate,
      lastOrderStatus,
      preferredMethod,
      orders: sortedOrders,
      tables,
      addresses,
      isReturning,
      isRecent,
    });
  }

  return customers;
}
