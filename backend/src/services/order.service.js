import { prisma } from "../config/prisma.js";
import { Delivery } from "../models/Delivery.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Customer } from "../models/Customer.js";
import { Admin } from "../models/Admin.js";
import { SameDayDeliveryStrategy } from "../models/strategies/SameDayDeliveryStrategy.js";
import { StandardDeliveryStrategy } from "../models/strategies/StandardDeliveryStrategy.js";
import { GeofencingService } from "./geofencing.service.js";
import { DeliverySlotService } from "./deliverySlot.service.js";
import { PaymentService } from "./payment.service.js";
import { ReceiptService } from "./receipt.service.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { emitOrderChanged } from "../realtime/socket.js";

const geofencingService = new GeofencingService();
const deliverySlotService = new DeliverySlotService();
const paymentService = new PaymentService();
const receiptService = new ReceiptService();

export class OrderService {
  buildDeliveryStrategy(type) {
    return type === "STANDARD"
      ? new StandardDeliveryStrategy()
      : new SameDayDeliveryStrategy();
  }

  mapOrder(record) {
    return {
      id: record.id,
      userId: record.userId,
      subtotal: Number(record.subtotal),
      deliveryFee: Number(record.deliveryFee),
      total: Number(record.total),
      status: record.status,
      paymentMethod: record.paymentMethod,
      paymentStatus: record.paymentStatus,
      paymentProvider: record.paymentProvider,
      paymentReference: record.paymentReference,
      paymentCheckoutId: record.paymentCheckoutId,
      paidAt: record.paidAt,
      pickerId: record.pickerId,
      pickerNotes: record.pickerNotes,
      items: record.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.price),
        product: item.product,
        substituteProductId: item.substituteProductId,
        substitutionNote: item.substitutionNote,
        substituteProduct: item.substituteProduct || null
      })),
      delivery: record.delivery
        ? {
            ...record.delivery,
            distanceKm: record.delivery.distanceKm ? Number(record.delivery.distanceKm) : null,
            deliveryFee: Number(record.delivery.deliveryFee),
            estimatedAt: record.delivery.estimatedAt
          }
        : null,
      deliverySlot: record.deliverySlot || null,
      createdAt: record.createdAt
    };
  }

  async checkout(userId, payload) {
    // Verify user has checkout permission via OOP model
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found.", 404);

    const userEntity = user.role === ROLES.CUSTOMER ? new Customer(user) : new Admin(user);
    if (typeof userEntity.canCheckout === "function" && !userEntity.canCheckout()) {
      throw new AppError("Your account does not have checkout permission.", 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          }
        }
      });

      if (!cart || cart.items.length === 0) {
        throw new AppError("Cart is empty.", 400);
      }

      const strategy = this.buildDeliveryStrategy(payload.deliveryType);
      const delivery = new Delivery({
        address: payload.address,
        strategy
      });

      // ── Geofencing: Validate GPS location & calculate delivery fee ──
      const geoResult = await geofencingService.validateLocation(
        payload.latitude,
        payload.longitude,
        payload.accuracyMeters
      );

      if (!geoResult.isWithinRadius) {
        throw new AppError(
          geoResult.reason ||
            `Your location is ${geoResult.displayDistanceKm}km away. We only deliver within ${geoResult.store.deliveryRadius}km.`,
          400
        );
      }

      const distanceKm = geoResult.distanceKm;
      const deliveryFee = geoResult.deliveryFee;
      const geoLat = payload.latitude;
      const geoLon = payload.longitude;

      // ── Delivery Slot ──────────────────────────────────
      let deliverySlotId = null;
      if (payload.deliverySlotId) {
        await deliverySlotService.bookSlot(payload.deliverySlotId);
        deliverySlotId = payload.deliverySlotId;
      }

      // ── Calculate Order Total ──────────────────────────
      const orderEntity = new Order({
        userId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.product.price)
        }))
      });

      orderEntity.calculateTotal();
      const subtotal = orderEntity.total;
      const grandTotal = subtotal + deliveryFee;

      // ── Reserve Stock ──────────────────────────────────
      for (const item of cart.items) {
        const productEntity = new Product(item.product);
        productEntity.reserveStock(item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: productEntity.stock
          }
        });
      }

      // ── Create Order ───────────────────────────────────
      const createdOrder = await tx.order.create({
        data: {
          userId,
          subtotal,
          deliveryFee,
          total: grandTotal,
          status: "PENDING",
          paymentMethod: payload.paymentMethod || "COD",
          paymentStatus: payload.paymentMethod === "GCASH" ? "PENDING" : "PENDING",
          paymentProvider: payload.paymentMethod === "GCASH" ? "PAYMONGO" : null,
          deliverySlotId,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // ── Create Delivery Record ─────────────────────────
      const deliveryRecord = delivery.schedule(createdOrder.id);

      await tx.delivery.create({
        data: {
          ...deliveryRecord,
          latitude: geoLat,
          longitude: geoLon,
          distanceKm,
          deliveryFee
        }
      });

      // ── Clear Cart ─────────────────────────────────────
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      // ── Return Complete Order ──────────────────────────
      const order = await tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          items: {
            include: {
              product: true,
              substituteProduct: true
            }
          },
          delivery: true,
          deliverySlot: true
        }
      });

      const mappedOrder = this.mapOrder(order);

      if (payload.paymentMethod === "GCASH") {
        const checkoutSession = await paymentService.createGcashCheckoutSession({
          order: mappedOrder,
          user,
          successUrl: env.checkoutSuccessUrl,
          cancelUrl: env.checkoutCancelUrl
        });

        await tx.order.update({
          where: { id: createdOrder.id },
          data: {
            paymentCheckoutId: checkoutSession.checkoutSessionId
          }
        });

        return {
          ...mappedOrder,
          paymentCheckoutUrl: checkoutSession.checkoutUrl,
          paymentCheckoutId: checkoutSession.checkoutSessionId
        };
      }

      return mappedOrder;
    });

    emitOrderChanged({
      orderId: result.id,
      userId,
      status: result.status,
      type: "created"
    });

    return result;
  }

  // ── Cancel Order (Customer) ──────────────────────────────
  async cancelOrder(userId, orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            substituteProduct: true
          }
        },
        delivery: true,
        deliverySlot: true
      }
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    if (order.userId !== userId) {
      throw new AppError("You can only cancel your own orders.", 403);
    }

    if (order.status !== "PENDING") {
      throw new AppError(
        `Cannot cancel this order — it is already "${order.status}". Only PENDING orders can be cancelled.`,
        400
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // ── Restore stock for each item ──
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity }
          }
        });
      }

      // ── Release delivery slot if one was booked ──
      if (order.deliverySlotId) {
        await deliverySlotService.releaseSlot(order.deliverySlotId, tx);
      }

      // ── Update order status to CANCELLED ──
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
        include: {
          items: {
            include: {
              product: true,
              substituteProduct: true
            }
          },
          delivery: true,
          deliverySlot: true
        }
      });

      // ── Sync delivery record status ──
      if (updated.delivery) {
        await tx.delivery.update({
          where: { id: updated.delivery.id },
          data: { status: "CANCELLED" }
        });
        updated.delivery.status = "CANCELLED";
      }

      return this.mapOrder(updated);
    });

    emitOrderChanged({
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      status: updatedOrder.status,
      type: "cancelled"
    });

    return updatedOrder;
  }

  async listOrders(user, { page, limit } = {}) {
    const where = user.role === ROLES.ADMIN ? {} : { userId: user.id };
    const include = {
      items: {
        include: {
          product: true,
          substituteProduct: true
        }
      },
      delivery: true,
      deliverySlot: true
    };

    // If no pagination params, return all (backward-compatible)
    if (!page && !limit) {
      const orders = await prisma.order.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" }
      });

      return { orders: orders.map((o) => this.mapOrder(o)) };
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (currentPage - 1) * perPage;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage
      }),
      prisma.order.count({ where })
    ]);

    return {
      orders: orders.map((o) => this.mapOrder(o)),
      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  // Maps order status → delivery status for synchronization
  getDeliveryStatusForOrder(orderStatus) {
    const statusMap = {
      PENDING: "PENDING",
      CONFIRMED: "SCHEDULED",
      PACKING: "SCHEDULED",
      OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED"
    };

    return statusMap[orderStatus] || null;
  }

  async updateStatus(orderId, status) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            substituteProduct: true
          }
        },
        delivery: true,
        deliverySlot: true
      }
    });

    if (!existing) {
      throw new AppError("Order not found.", 404);
    }

    const entity = new Order(existing);
    entity.markStatus(status);

    // Update the order status
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: entity.status },
      include: {
        items: {
          include: {
            product: true,
            substituteProduct: true
          }
        },
        delivery: true,
        deliverySlot: true
      }
    });

    // Sync the delivery record status if one exists
    const deliveryStatus = this.getDeliveryStatusForOrder(status);
    if (updated.delivery && deliveryStatus) {
      await prisma.delivery.update({
        where: { id: updated.delivery.id },
        data: { status: deliveryStatus }
      });

      // Refresh delivery in the response
      updated.delivery.status = deliveryStatus;
    }

    const mappedOrder = this.mapOrder(updated);

    emitOrderChanged({
      orderId: mappedOrder.id,
      userId: mappedOrder.userId,
      status: mappedOrder.status,
      type: "status_updated"
    });

    return mappedOrder;
  }

  async generateReceipt(user, orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: true,
            substituteProduct: true
          }
        },
        delivery: true,
        deliverySlot: true
      }
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    const canAccess = user.role === ROLES.ADMIN || user.role === ROLES.STAFF || order.userId === user.id;

    if (!canAccess) {
      throw new AppError("You do not have permission to access this receipt.", 403);
    }

    if (order.status !== "DELIVERED") {
      throw new AppError("Receipts are available once an order has been delivered.", 400);
    }

    return receiptService.createOrderReceipt(order);
  }

  async markPaymentPaid({ orderId, checkoutSessionId, paymentReference }) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          orderId ? { id: Number(orderId) } : undefined,
          checkoutSessionId ? { paymentCheckoutId: checkoutSessionId } : undefined
        ].filter(Boolean)
      }
    });

    if (!order) {
      throw new AppError("Order not found for payment event.", 404);
    }

    if (order.paymentStatus === "PAID") {
      return order;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        paymentReference: paymentReference || order.paymentReference,
        paidAt: new Date(),
        paymentProvider: "PAYMONGO"
      }
    });

    emitOrderChanged({
      orderId: updated.id,
      userId: updated.userId,
      status: updated.status,
      type: "payment_paid"
    });

    return updated;
  }

  async markPaymentExpired({ orderId, checkoutSessionId }) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          orderId ? { id: Number(orderId) } : undefined,
          checkoutSessionId ? { paymentCheckoutId: checkoutSessionId } : undefined
        ].filter(Boolean)
      },
      include: {
        items: true,
        delivery: true
      }
    });

    if (!order || order.paymentStatus === "PAID") {
      return order;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity }
          }
        });
      }

      if (order.deliverySlotId) {
        await deliverySlotService.releaseSlot(order.deliverySlotId, tx);
      }

      if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: { status: "CANCELLED" }
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "EXPIRED"
        }
      });
    });

    if (updatedOrder) {
      emitOrderChanged({
        orderId: updatedOrder.id,
        userId: updatedOrder.userId,
        status: updatedOrder.status,
        type: "payment_expired"
      });
    }

    return updatedOrder;
  }

  async handlePaymongoWebhook(rawBody, signatureHeader) {
    paymentService.verifyWebhookSignature(rawBody, signatureHeader);

    const event = JSON.parse(rawBody.toString("utf8"));
    const eventType = event?.data?.attributes?.type;
    const resource = event?.data?.attributes?.data;
    const resourceAttributes = resource?.attributes || {};
    const metadata = resourceAttributes.metadata || {};
    const orderId = metadata.orderId;
    const checkoutSessionId = resource?.id || resourceAttributes.id || metadata.checkoutSessionId;
    const paymentReference =
      resourceAttributes.reference_number ||
      resourceAttributes.payments?.[0]?.attributes?.id ||
      resourceAttributes.payments?.[0]?.id ||
      null;

    if (eventType === "checkout_session.payment.paid" || eventType === "payment.paid") {
      await this.markPaymentPaid({
        orderId,
        checkoutSessionId,
        paymentReference
      });
    }

    if (
      eventType === "checkout_session.expired" ||
      eventType === "payment.failed" ||
      eventType === "checkout_session.payment.failed"
    ) {
      await this.markPaymentExpired({
        orderId,
        checkoutSessionId
      });
    }

    return { received: true };
  }
}
