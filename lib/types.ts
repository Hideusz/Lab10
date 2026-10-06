import { z } from "zod";

// Definicja dozwolonych typów produktów zgodnie z instrukcją
const productTypeSchema = z.enum(["cpu", "gpu", "ram", "disk"]);

export const productSchema = z.object({
  id: z.number().int().positive(), // Unikalna dodatnia liczba całkowita
  code: z.string().length(10).regex(/^[A-Z0-9]+$/), // 10 wielkich liter ASCII lub cyfr
  name: z.string().min(1), // Niepusta nazwa
  type: productTypeSchema,
  price: z.number().int().nonnegative(), // Nieujemna liczba całkowita w groszach
  amount: z.number().int().nonnegative(), // Nieujemna liczba całkowita
  description: z.string(),
  date: z.string().datetime(), // Poprawna data ISO 8601
  image: z.string() // URL lokalnego pliku
});

export const productsArraySchema = z.array(productSchema)
  .refine(items => {
    // Sprawdzanie unikalności ID i kodu - rzucamy błąd, gdy nie są unikalne
    const ids = items.map(item => item.id);
    const codes = items.map(item => item.code);
    const uniqueIds = new Set(ids);
    const uniqueCodes = new Set(codes);
    return uniqueIds.size === ids.length && uniqueCodes.size === codes.length;
  }, { message: "ID lub Code w tablicy nie są unikalne" });

export type Product = z.infer<typeof productSchema>;
