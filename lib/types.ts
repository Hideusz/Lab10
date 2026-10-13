import { z } from "zod";
const productTypeSchema = z.enum(["cpu", "gpu", "ram", "disk"]);

export const productSchema = z.object({
  id: z.number().int().positive(), 
  code: z.string().length(10).regex(/^[A-Z0-9]+$/), 
  name: z.string().min(1),
  type: productTypeSchema,
  price: z.number().int().nonnegative(), 
  amount: z.number().int().nonnegative(), 
  description: z.string(),
  date: z.string().datetime(), 
  image: z.string() 
});

export const productsArraySchema = z.array(productSchema)
  .refine(items => {
    const ids = items.map(item => item.id);
    const codes = items.map(item => item.code);
    const uniqueIds = new Set(ids);
    const uniqueCodes = new Set(codes);
    return uniqueIds.size === ids.length && uniqueCodes.size === codes.length;
  }, { message: "ID lub Code w tablicy nie są unikalne" });

export type Product = z.infer<typeof productSchema>;
