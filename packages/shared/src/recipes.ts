import { z } from 'zod';

/** Önüm (kompozit haryt) resepti (SPEC §5.12/§6.6 "Forma-2 döret"). */
export const recipeItemInputSchema = z.object({
  ingredientProductId: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive(),
});
export type RecipeItemInput = z.infer<typeof recipeItemInputSchema>;

export const recipeInputSchema = z.object({
  name: z.string().min(1).max(191),
  code: z.string().min(1).max(64).optional(),
  items: z.array(recipeItemInputSchema).min(1),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;
