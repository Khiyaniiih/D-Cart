import { z } from "zod";

export const productIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createProductSchema = z.object({
  name: z.string().min(2).max(150),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  categoryId: z.number().int().positive()
});

export const updateProductSchema = createProductSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: "At least one field is required for update."
  }
);
