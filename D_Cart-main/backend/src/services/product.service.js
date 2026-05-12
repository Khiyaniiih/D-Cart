import { prisma } from "../config/prisma.js";
import { Product } from "../models/Product.js";
import { Admin } from "../models/Admin.js";
import { AppError } from "../utils/AppError.js";

export class ProductService {
  mapProduct(record) {
    return new Product(record).toJSON();
  }

  verifyInventoryAccess(user) {
    if (!user) return; // Skip if no user context (public reads)
    const entity = new Admin(user);
    if (!entity.canManageInventory()) {
      throw new AppError("You do not have inventory management permission.", 403);
    }
  }

  async listProducts({ page, limit, categoryId } = {}) {
    const where = categoryId ? { categoryId: Number(categoryId) } : {};

    // If no pagination params, return all (backward-compatible)
    if (!page && !limit) {
      const products = await prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" }
      });

      return { products: products.map((p) => this.mapProduct(p)) };
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(limit) || 12));
    const skip = (currentPage - 1) * perPage;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage
      }),
      prisma.product.count({ where })
    ]);

    return {
      products: products.map((p) => this.mapProduct(p)),
      pagination: {
        page: currentPage,
        limit: perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  async getProductById(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true
      }
    });

    if (!product) {
      throw new AppError("Product not found.", 404);
    }

    return this.mapProduct(product);
  }

  async createProduct(payload, user) {
    this.verifyInventoryAccess(user);
    await this.ensureCategoryExists(payload.categoryId);

    const created = await prisma.product.create({
      data: payload,
      include: {
        category: true
      }
    });

    return this.mapProduct(created);
  }

  async updateProduct(productId, payload, user) {
    this.verifyInventoryAccess(user);
    await this.getProductById(productId);

    if (payload.categoryId) {
      await this.ensureCategoryExists(payload.categoryId);
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: payload,
      include: {
        category: true
      }
    });

    return this.mapProduct(updated);
  }

  async deleteProduct(productId, user) {
    this.verifyInventoryAccess(user);
    await this.getProductById(productId);

    await prisma.product.delete({
      where: { id: productId }
    });
  }

  async ensureCategoryExists(categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new AppError("Category not found.", 404);
    }
  }
}
