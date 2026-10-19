"use client";

import {
  DeliveryTypeUnavailableError,
  createProductOrderFormSchema,
  type DeliveryFee,
  type Product,
  type ProductOrderFormValues,
} from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { PIXEL_CURRENCY, getMetaTracking, trackMetaEvent } from "@/lib/analytics/meta-pixel";
import { OrderError, placeProductOrder } from "@/lib/data/orders";
import { toServerErrors } from "@/lib/form-errors";
import { routes } from "@/lib/routes";

/** Id of the order form section: the mobile sticky button scrolls to it. */
export const ORDER_FORM_ID = "commander";

/** Scrolls to the first invalid field (color and size come first, above the form) and focuses it. */
function revealFirstError(root: HTMLElement | null) {
  const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  invalid.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  const focusable = invalid.matches("input, select, textarea, button")
    ? invalid
    : invalid.querySelector<HTMLElement>("input:not(:disabled), select, textarea, button");
  focusable?.focus({ preventScroll: true });
}

function useProductOrderForm(product: Product, onSubmitted: () => void) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  // The shared rules plus this product's colors and stock per color + size.
  const schema = useMemo(() => createProductOrderFormSchema(product), [product]);

  const defaultValues: ProductOrderFormValues = {
    productId: product.id,
    // A single color is selected automatically; several colors must be chosen.
    color: product.colors.length === 1 ? (product.colors[0]?.name ?? "") : "",
    size: "",
    quantity: 1,
    fullName: "",
    phone: "",
    wilayaCode: "",
    commune: "",
    deliveryType: "home",
    address: "",
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        await placeProductOrder(schema.parse(value), {
          website: honeypotRef.current?.value ?? "",
          tracking: getMetaTracking(),
        });
        onSubmitted();
      } catch (error) {
        if (error instanceof OrderError) {
          // The server's French errors go under their field (e.g. stock just sold out).
          const { errors, unknownMessages } = toServerErrors(
            error.fields,
            Object.keys(defaultValues),
          );
          form.setErrorMap({ onDynamic: errors });
          const shownUnderFields = Object.keys(errors.fields).length > 0;
          setSubmitError(shownUnderFields ? (unknownMessages[0] ?? null) : error.message);
          if (shownUnderFields) requestAnimationFrame(() => revealFirstError(rootRef.current));
          return;
        }
        setSubmitError(
          error instanceof DeliveryTypeUnavailableError
            ? error.message
            : "Une erreur est survenue, votre commande n'a pas été envoyée. Veuillez réessayer.",
        );
      }
    },
    onSubmitInvalid: () => {
      // Let React render the error messages and aria-invalid first.
      requestAnimationFrame(() => revealFirstError(rootRef.current));
    },
  });

  return { form, submitError, rootRef, honeypotRef };
}

type ProductOrderForm = ReturnType<typeof useProductOrderForm>["form"];

interface ProductOrderContextValue {
  form: ProductOrderForm;
  product: Product;
  deliveryFees: readonly DeliveryFee[];
  /** Submits once: further calls are ignored while an order is being sent or after it is placed. */
  submit: () => Promise<void>;
  submitError: string | null;
  /** True once the order is placed, while the thank-you page loads. */
  placed: boolean;
  /** InitiateCheckout, sent the first time the customer starts filling the form. */
  startCheckout: () => void;
  /** Hidden anti-spam field of the order form. */
  honeypotRef: RefObject<HTMLInputElement | null>;
}

const ProductOrderContext = createContext<ProductOrderContextValue | null>(null);

export function useProductOrder(): ProductOrderContextValue {
  const value = use(ProductOrderContext);
  if (!value) throw new Error("useProductOrder must be used inside <ProductOrderProvider>.");
  return value;
}

/**
 * Owns the order form of a product page. The color, size and quantity selectors, the
 * gallery and the order form below the details all read and write the same form.
 */
export function ProductOrderProvider({
  product,
  deliveryFees,
  children,
}: {
  product: Product;
  deliveryFees: readonly DeliveryFee[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [placed, setPlaced] = useState(false);
  // Refs, not state: a second click in the same tick must already see them.
  const sending = useRef(false);
  const placedRef = useRef(false);
  const checkoutStarted = useRef(false);
  const { form, submitError, rootRef, honeypotRef } = useProductOrderForm(product, () => {
    placedRef.current = true;
    setPlaced(true);
    router.push(routes.orderReceived);
  });

  useEffect(() => {
    trackMetaEvent(
      "ViewContent",
      {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        value: product.price,
        currency: PIXEL_CURRENCY,
      },
      { dedupeKey: product.id },
    );
  }, [product.id, product.name, product.price]);

  const submit = async () => {
    // A double click (or Enter pressed twice) sends a single order.
    if (sending.current || placedRef.current) return;
    sending.current = true;
    try {
      await form.handleSubmit();
    } finally {
      sending.current = false;
    }
  };

  const startCheckout = () => {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    const { quantity } = form.state.values;
    trackMetaEvent("InitiateCheckout", {
      content_ids: [product.id],
      content_type: "product",
      num_items: quantity,
      value: product.price * quantity,
      currency: PIXEL_CURRENCY,
    });
  };

  return (
    <ProductOrderContext
      value={{
        form,
        product,
        deliveryFees,
        submit,
        submitError,
        placed,
        startCheckout,
        honeypotRef,
      }}
    >
      <div ref={rootRef}>{children}</div>
    </ProductOrderContext>
  );
}
