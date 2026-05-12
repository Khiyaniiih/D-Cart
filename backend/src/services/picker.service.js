import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { emitOrderChanged } from "../realtime/socket.js";

export class PickerService {
  /**
   * Get all orders assigned to a picker, or all CONFIRMED/PACKING orders if unassigned.
   */
  async getPickerOrders(pickerId) {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { pickerId },
          {
            pickerId: null,
            status: { in: ["CONFIRMED", "PACKING"] }
          }
        ]
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { include: { category: true } },
            substituteProduct: true
          }
        },
        delivery: true,
        deliverySlot: true
      },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      customer: order.user,
      pickerId: order.pickerId,
      pickerNotes: order.pickerNotes,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.price),
        product: item.product,
        substituteProductId: item.substituteProductId,
        substitutionNote: item.substitutionNote,
        substituteProduct: item.substituteProduct
      })),
      delivery: order.delivery,
      deliverySlot: order.deliverySlot,
      createdAt: order.createdAt
    }));
  }

  /**
   * Picker claims an order for fulfillment.
   */
  async claimOrder(pickerId, orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    if (order.pickerId && order.pickerId !== pickerId) {
      throw new AppError("This order is already claimed by another picker.", 409);
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        pickerId,
        status: order.status === "CONFIRMED" ? "PACKING" : order.status
      },
      include: {
        items: { include: { product: true, substituteProduct: true } },
        delivery: true
      }
    });

    emitOrderChanged({
      orderId: updated.id,
      userId: updated.userId,
      status: updated.status,
      type: "claimed"
    });

    return updated;
  }

  /**
   * Picker substitutes an item in an order.
   */
  async substituteItem(pickerId, orderId, orderItemId, substituteProductId, note) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    if (order.pickerId !== pickerId) {
      throw new AppError("You are not assigned to this order.", 403);
    }

    const orderItem = order.items.find((item) => item.id === orderItemId);
    if (!orderItem) {
      throw new AppError("Order item not found.", 404);
    }

    // Verify substitute product exists and has stock
    const substituteProduct = await prisma.product.findUnique({
      where: { id: substituteProductId }
    });

    if (!substituteProduct) {
      throw new AppError("Substitute product not found.", 404);
    }

    if (substituteProduct.stock < orderItem.quantity) {
      throw new AppError("Substitute product does not have enough stock.", 400);
    }

    // Perform the substitution within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Restore original product stock
      await tx.product.update({
        where: { id: orderItem.productId },
        data: { stock: { increment: orderItem.quantity } }
      });

      // Deduct substitute product stock
      await tx.product.update({
        where: { id: substituteProductId },
        data: { stock: { decrement: orderItem.quantity } }
      });

      // Update the order item
      const updatedItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          substituteProductId,
          substitutionNote: note || `Substituted with ${substituteProduct.name}`,
          price: substituteProduct.price
        },
        include: { product: true, substituteProduct: true }
      });

      // Recalculate order total
      const allItems = await tx.orderItem.findMany({
        where: { orderId }
      });

      const newSubtotal = allItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newSubtotal + Number(order.deliveryFee)
        }
      });

      return updatedItem;
    });

    emitOrderChanged({
      orderId,
      userId: order.userId,
      status: order.status,
      type: "substituted"
    });

    return result;
  }

  /**
   * Picker adds notes to an order.
   */
  async updatePickerNotes(pickerId, orderId, notes) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) throw new AppError("Order not found.", 404);
    if (order.pickerId !== pickerId) throw new AppError("You are not assigned to this order.", 403);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { pickerNotes: notes }
    });

    emitOrderChanged({
      orderId: updated.id,
      userId: updated.userId,
      status: updated.status,
      type: "note_updated"
    });

    return updated;
  }
}
