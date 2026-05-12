import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[+0-9()\-\s]+$/, "Phone number contains invalid characters."),
  password: z.string().min(8).max(100)
});
