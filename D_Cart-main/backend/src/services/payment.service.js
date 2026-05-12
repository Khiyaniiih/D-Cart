import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export class PaymentService {
  constructor() {
    this.baseUrl = env.paymongoApiBaseUrl.replace(/\/$/, "");
  }

  ensureConfigured() {
    if (!env.paymongoSecretKey) {
      throw new AppError("PayMongo secret key is not configured.", 500);
    }
  }

  buildAuthHeader() {
    const token = Buffer.from(`${env.paymongoSecretKey}:`).toString("base64");
    return `Basic ${token}`;
  }

  toCentavos(amount) {
    return Math.round(Number(amount) * 100);
  }

  async createGcashCheckoutSession({ order, user, successUrl, cancelUrl }) {
    this.ensureConfigured();

    const lineItems = order.items.map((item) => ({
      currency: "PHP",
      amount: this.toCentavos(item.price),
      name: item.product.name,
      quantity: item.quantity
    }));

    if (Number(order.deliveryFee) > 0) {
      lineItems.push({
        currency: "PHP",
        amount: this.toCentavos(order.deliveryFee),
        name: "Delivery Fee",
        quantity: 1
      });
    }

    const response = await fetch(`${this.baseUrl}/v1/checkout_sessions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.buildAuthHeader()
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: user.name,
              email: user.email,
              phone: user.phone || undefined
            },
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `D'Cart order #${order.id}`,
            line_items: lineItems,
            payment_method_types: ["gcash"],
            reference_number: `order-${order.id}`,
            success_url: `${successUrl}?orderId=${order.id}`,
            cancel_url: `${cancelUrl}?orderId=${order.id}`,
            metadata: {
              orderId: String(order.id),
              userId: String(user.id)
            }
          }
        }
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new AppError(
        payload?.errors?.[0]?.detail || payload?.message || "Unable to create GCash checkout session.",
        response.status
      );
    }

    const checkoutSession = payload?.data;

    return {
      checkoutSessionId: checkoutSession?.id,
      checkoutUrl: checkoutSession?.attributes?.checkout_url
    };
  }

  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!env.paymongoWebhookSecret) {
      throw new AppError("PayMongo webhook secret is not configured.", 500);
    }

    if (!signatureHeader) {
      throw new AppError("Missing PayMongo webhook signature.", 400);
    }

    const expectedSignature = createHmac("sha256", env.paymongoWebhookSecret)
      .update(rawBody)
      .digest("hex");

    const providedSignature = signatureHeader.trim();
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new AppError("Invalid PayMongo webhook signature.", 400);
    }
  }
}
