import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, ShoppingBag, Store, Truck, Utensils } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, Section } from "@/components/site/Section";
import { useCart } from "@/lib/cart";
import { formatETB, getProduct } from "@/lib/menu-data";
import { buildOrder, methodLabels, saveOrder, type OrderMethod } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — NEBA Café" },
      {
        name: "description",
        content: "Complete your NEBA Café order: method, details and payment.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Checkout — NEBA Café" },
      { property: "og:description", content: "Complete your NEBA Café order." },
    ],
  }),
  component: Checkout,
});

const steps = ["Ordering method", "Customer information", "Order summary", "Payment"] as const;

const DELIVERY_FEE = 80;

const methodOptions: {
  value: OrderMethod;
  label: string;
  text: string;
  icon: typeof Utensils;
}[] = [
  {
    value: "dine-in",
    label: "Dine-in",
    text: "Enjoy your meal fresh at the café.",
    icon: Utensils,
  },
  {
    value: "takeaway",
    label: "Takeaway",
    text: "Order ahead and collect your food.",
    icon: Store,
  },
  {
    value: "delivery",
    label: "Delivery",
    text: `Delivered to your location (+${DELIVERY_FEE} ETB).`,
    icon: Truck,
  },
];

type FormField = "name" | "phone" | "table" | "address";
type FormErrors = Partial<Record<FormField, string>>;

function Checkout() {
  const navigate = useNavigate();
  const { lines, subtotal, clear } = useCart();
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<OrderMethod>("dine-in");
  const [form, setForm] = useState({ name: "", phone: "", table: "", address: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [payment, setPayment] = useState("mobile");
  const [submitting, setSubmitting] = useState(false);

  const delivery = method === "delivery" ? DELIVERY_FEE : 0;
  const total = subtotal + delivery;

  if (lines.length === 0) {
    return (
      <Section className="max-w-2xl">
        <h1 className="mb-8 text-4xl font-semibold">Checkout</h1>
        <EmptyState
          icon={<ShoppingBag className="size-8" />}
          title="Your cart is empty"
          description="Add something from the menu before checking out."
          action={
            <Button asChild>
              <Link to="/menu">Explore Menu</Link>
            </Button>
          }
        />
      </Section>
    );
  }

  const handleFieldChange = (field: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleMethodSelect = (newMethod: OrderMethod) => {
    setMethod(newMethod);
    // Clear any obsolete field errors when method changes
    setErrors({});
  };

  const validateCurrentStep = (): boolean => {
    if (step === 0) {
      // Step 0 is ordering method selection; method is always one of the valid enum values
      return true;
    }

    if (step === 1) {
      // Step 1 is customer details for the selected method
      const newErrors: FormErrors = {};

      if (method === "dine-in") {
        if (!form.table.trim()) {
          newErrors.table = "Please enter your table number.";
        }
      } else {
        // Takeaway and Delivery require name and phone
        if (!form.name.trim()) {
          newErrors.name = "Please enter your name.";
        }
        if (!form.phone.trim()) {
          newErrors.phone = "Please enter your phone number.";
        } else if (!/^[0-9+\s-]{7,}$/.test(form.phone.trim())) {
          newErrors.phone = "Enter a valid phone number (at least 7 digits).";
        }

        if (method === "delivery") {
          if (!form.address.trim()) {
            newErrors.address = "Please enter your delivery address.";
          }
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (step === 3) {
      if (!payment) {
        toast.error("Please select a payment method.");
        return false;
      }
      return true;
    }

    return true;
  };

  const next = () => {
    if (validateCurrentStep()) {
      setStep((s) => Math.min(steps.length - 1, s + 1));
    }
  };

  const pay = () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    // The frontend never declares payment success on its own: this call stands in
    // for POST /api/payments, whose result the backend verifies before confirming.
    setTimeout(() => {
      const order = saveOrder(
        buildOrder({
          lines,
          method,
          paymentMethod: payment === "mobile" ? "Mobile Payment" : "Other Supported Method",
          delivery,
          customer: {
            name: form.name.trim() || (method === "dine-in" ? "Dine-in guest" : ""),
            phone: form.phone.trim(),
            ...(method === "dine-in" && form.table.trim() ? { table: form.table.trim() } : {}),
            ...(method === "delivery" && form.address.trim()
              ? { address: form.address.trim() }
              : {}),
          },
        }),
      );
      clear();
      setSubmitting(false);
      toast.success("Order confirmed");
      void navigate({ to: "/order/$id", params: { id: order.id } });
    }, 900);
  };

  return (
    <Section className="max-w-3xl">
      <h1 className="text-4xl font-semibold">Checkout</h1>

      <ol className="mt-8 flex flex-wrap gap-2" aria-label="Checkout progress">
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              i === step && "border-primary bg-primary text-primary-foreground font-medium",
              i < step && "border-success text-success cursor-pointer hover:bg-secondary/60",
              i > step && "border-border text-muted-foreground",
            )}
            onClick={() => {
              // Allow jumping back to previously completed steps
              if (i < step) {
                setStep(i);
              }
            }}
          >
            {i < step ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <span className="font-semibold">{i + 1}</span>
            )}
            {label}
          </li>
        ))}
      </ol>

      <div className="surface-card mt-8 p-6 sm:p-8">
        {/* STEP 1: ORDERING METHOD */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold">Step 1 — Ordering method</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                How would you like to receive your food today?
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {methodOptions.map((m) => {
                const isSelected = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => handleMethodSelect(m.value)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex flex-col rounded-xl border p-5 text-left transition-all",
                      isSelected
                        ? "border-primary bg-accent/60 shadow-[var(--shadow-soft)] ring-1 ring-primary"
                        : "border-border hover:bg-secondary/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <m.icon className="size-6 text-primary" aria-hidden />
                      {isSelected && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-4 block font-display text-lg font-semibold">{m.label}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{m.text}</span>
                  </button>
                );
              })}
            </div>

            {method === "delivery" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Delivery Notice</p>
                <p className="mt-0.5">
                  A flat delivery fee of {DELIVERY_FEE} ETB will be added to your order summary. You
                  will provide your delivery address in the next step.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CUSTOMER INFORMATION */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Step 2 — Customer information
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {method === "dine-in" && "Enter your table number for café table service."}
                  {method === "takeaway" && "Enter your contact details for order pickup."}
                  {method === "delivery" && "Enter your contact details and delivery location."}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs">
                <span className="font-medium text-foreground">{methodLabels[method]}</span>
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="font-medium text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Dine-in fields */}
            {method === "dine-in" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="table" className="text-sm font-medium">
                    Table number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="table"
                    value={form.table}
                    onChange={(e) => handleFieldChange("table", e.target.value)}
                    placeholder="e.g. 12"
                    aria-invalid={!!errors.table}
                    aria-describedby={errors.table ? "error-table" : undefined}
                    className={cn(
                      errors.table && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.table && (
                    <p id="error-table" role="alert" className="text-xs text-destructive">
                      {errors.table}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Guest name <span className="text-xs text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone number <span className="text-xs text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="+251 ..."
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Takeaway & Delivery fields */}
            {method !== "dine-in" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="e.g. Abebe Kebede"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "error-name" : undefined}
                      className={cn(
                        errors.name && "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {errors.name && (
                      <p id="error-name" role="alert" className="text-xs text-destructive">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="+251 91 123 4567"
                      autoComplete="tel"
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "error-phone" : undefined}
                      className={cn(
                        errors.phone && "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {errors.phone && (
                      <p id="error-phone" role="alert" className="text-xs text-destructive">
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                {method === "delivery" && (
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Delivery address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => handleFieldChange("address", e.target.value)}
                      placeholder="Street name, building, apartment, landmark"
                      autoComplete="street-address"
                      aria-invalid={!!errors.address}
                      aria-describedby={errors.address ? "error-address" : undefined}
                      className={cn(
                        errors.address && "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {errors.address && (
                      <p id="error-address" role="alert" className="text-xs text-destructive">
                        {errors.address}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: ORDER SUMMARY */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold">Step 3 — Order summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review your items, delivery details and final total before payment.
              </p>
            </div>

            {/* Products breakdown */}
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {lines.map((l) => {
                const p = getProduct(l.productId);
                if (!p) return null;
                return (
                  <div
                    key={l.productId}
                    className="flex items-center justify-between gap-4 p-4 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="size-12 rounded-lg object-cover"
                        loading="lazy"
                        width={48}
                        height={48}
                      />
                      <div>
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatETB(p.price)} × {l.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-foreground">
                      {formatETB(p.price * l.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Customer & Method verification card */}
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Order details</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Edit details
                </button>
              </div>
              <dl className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-foreground">Method: </dt>
                  <dd className="inline">{methodLabels[method]}</dd>
                </div>
                {method === "dine-in" && (
                  <div>
                    <dt className="inline font-medium text-foreground">Table: </dt>
                    <dd className="inline">#{form.table || "Not specified"}</dd>
                  </div>
                )}
                {form.name && (
                  <div>
                    <dt className="inline font-medium text-foreground">Name: </dt>
                    <dd className="inline">{form.name}</dd>
                  </div>
                )}
                {form.phone && (
                  <div>
                    <dt className="inline font-medium text-foreground">Phone: </dt>
                    <dd className="inline">{form.phone}</dd>
                  </div>
                )}
                {method === "delivery" && form.address && (
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium text-foreground">Delivery address: </dt>
                    <dd className="inline">{form.address}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Calculations breakdown */}
            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatETB(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery fee</dt>
                <dd className="font-medium">
                  {delivery > 0 ? formatETB(delivery) : "Free (Dine-in / Takeaway)"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="font-medium">{formatETB(0)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 font-display text-xl font-semibold">
                <dt>Total</dt>
                <dd className="text-primary">{formatETB(total)}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* STEP 4: PAYMENT */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold">Step 4 — Payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select your preferred payment method to complete the order.
              </p>
            </div>

            <div className="surface-card flex items-center justify-between p-5 bg-secondary/30">
              <span className="text-sm font-medium text-muted-foreground">Amount to pay</span>
              <span className="font-display text-3xl font-semibold text-primary">
                {formatETB(total)}
              </span>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Payment method</legend>
              {[
                {
                  id: "mobile",
                  label: "Mobile Payment",
                  desc: "Telebirr, CBE Birr or supported mobile wallets",
                },
                {
                  id: "other",
                  label: "Other Supported Method",
                  desc: "Card or in-person payment upon pickup / delivery",
                },
              ].map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                    payment === option.id
                      ? "border-primary bg-accent/60 ring-1 ring-primary"
                      : "border-border hover:bg-secondary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={option.id}
                    checked={payment === option.id}
                    onChange={() => setPayment(option.id)}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <div>
                    <span className="block font-medium text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.desc}</span>
                  </div>
                </label>
              ))}
            </fieldset>

            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Note: This is a demo checkout. Payment results are verified by the backend in
              production before orders are marked as paid.
            </p>
          </div>
        )}

        {/* NAVIGATION BUTTONS */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
          >
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={pay} disabled={submitting}>
              <CreditCard className="size-4" />
              {submitting ? "Processing…" : `Pay ${formatETB(total)}`}
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
