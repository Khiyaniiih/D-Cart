import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export class DeliverySlotService {
  /**
   * List available delivery slots for a given date range.
   * Only returns slots that are active and have available capacity.
   */
  async getAvailableSlots(dateFrom, dateTo) {
    const from = dateFrom ? new Date(dateFrom) : new Date();
    const to = dateTo
      ? new Date(dateTo)
      : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000); // default: next 7 days

    const slots = await prisma.deliverySlot.findMany({
      where: {
        date: { gte: from, lte: to },
        isActive: true
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });

    return slots
      .filter((slot) => slot.bookedCount < slot.maxOrders)
      .map((slot) => ({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxOrders: slot.maxOrders,
        bookedCount: slot.bookedCount,
        available: slot.maxOrders - slot.bookedCount
      }));
  }

  async getAllSlots() {
    const slots = await prisma.deliverySlot.findMany({
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });

    return slots.map((slot) => ({
      id: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxOrders: slot.maxOrders,
      bookedCount: slot.bookedCount,
      isActive: slot.isActive,
      available: slot.maxOrders - slot.bookedCount
    }));
  }

  /**
   * Book a delivery slot (increment bookedCount).
   */
  async bookSlot(slotId) {
    const slot = await prisma.deliverySlot.findUnique({ where: { id: slotId } });

    if (!slot) {
      throw new AppError("Delivery slot not found.", 404);
    }

    if (!slot.isActive) {
      throw new AppError("This delivery slot is no longer available.", 400);
    }

    if (slot.bookedCount >= slot.maxOrders) {
      throw new AppError("This delivery slot is fully booked.", 400);
    }

    return prisma.deliverySlot.update({
      where: { id: slotId },
      data: { bookedCount: { increment: 1 } }
    });
  }

  /**
   * Release a delivery slot (decrement bookedCount) when an order is cancelled.
   * Accepts an optional Prisma transaction client.
   */
  async releaseSlot(slotId, txClient) {
    const db = txClient || prisma;

    const slot = await db.deliverySlot.findUnique({ where: { id: slotId } });

    if (!slot) return; // Slot may have been deleted — skip silently

    if (slot.bookedCount > 0) {
      await db.deliverySlot.update({
        where: { id: slotId },
        data: { bookedCount: { decrement: 1 } }
      });
    }
  }

  /**
   * Admin: Create delivery slots for a date range.
   */
  async generateSlots(date, slots) {
    const targetDate = new Date(date);

    const created = [];
    for (const slot of slots) {
      const record = await prisma.deliverySlot.upsert({
        where: {
          date_startTime_endTime: {
            date: targetDate,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        },
        update: {
          maxOrders: slot.maxOrders || 5,
          isActive: true
        },
        create: {
          date: targetDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxOrders: slot.maxOrders || 5,
          isActive: true
        }
      });
      created.push(record);
    }

    return created;
  }
}
