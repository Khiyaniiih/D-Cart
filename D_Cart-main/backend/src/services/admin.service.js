import { prisma } from "../config/prisma.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js";

export class AdminService {
  async getDashboardMetrics() {
    const [
      orderCount,
      deliveredCount,
      productCount,
      pendingOrders,
      lowStockAlerts,
      salesAggregate
    ] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({
          where: { status: "DELIVERED" }
        }),
        prisma.product.count(),
        prisma.order.count({
          where: {
            status: {
              in: ["PENDING", "CONFIRMED", "PACKING", "OUT_FOR_DELIVERY"]
            }
          }
        }),
        prisma.product.count({
          where: {
            stock: {
              lte: 10
            }
          }
        }),
        prisma.order.aggregate({
          _sum: {
            total: true
          }
        })
      ]);

    const recentOrders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        delivery: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    });

    return {
      totals: {
        orders: orderCount,
        delivered: deliveredCount,
        products: productCount,
        pendingOrders,
        lowStockAlerts,
        sales: Number(salesAggregate._sum.total || 0)
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt,
        customer: order.user,
        delivery: order.delivery
      }))
    };
  }

  async createStaff(payload) {
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (existingUser) {
      throw new AppError("Email is already registered.", 409);
    }

    const hashedPassword = await hashPassword(payload.password);

    const staff = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: hashedPassword,
        role: ROLES.STAFF
      }
    });

    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      createdAt: staff.createdAt
    };
  }
}
