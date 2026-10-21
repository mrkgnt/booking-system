import { z } from "zod";

export const listCustomersQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export const customerIdParamSchema = z.object({ id: z.string().uuid() });

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(32).optional(),
  notes: z.string().max(5000).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
