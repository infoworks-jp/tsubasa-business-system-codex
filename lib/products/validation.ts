import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./types";

const optionalText = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.string().trim().nullable(),
);

const optionalMoney = z.union([
  z.number().int("整数で入力してください").min(0, "0円以上で入力してください"),
  z.null(),
]);

export const productInputSchema = z
  .object({
    productCode: z.string().trim().min(1, "商品コードは必須です").max(50),
    productName: z.string().trim().min(1, "商品名は必須です").max(100),
    category: z.enum(PRODUCT_CATEGORIES, {
      errorMap: () => ({ message: "カテゴリを選択してください" }),
    }),
    ticketButtonNumber: optionalText,
    ticketDisplayPosition: optionalText,
    salesStartDate: z
      .string()
      .min(1, "販売開始日は必須です")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "販売開始日を正しく入力してください"),
    salesEndDate: z
      .preprocess(
        (value) => (value === "" || value === undefined ? null : value),
        z.string().trim().nullable(),
      )
      .refine(
        (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
        "販売終了日を正しく入力してください",
      ),
    standardPrice: z
      .number({ invalid_type_error: "標準価格は数値で入力してください" })
      .int("標準価格は整数で入力してください")
      .min(0, "標準価格は0円以上で入力してください"),
    futureCost: optionalMoney,
    isActive: z.boolean().optional(),
    deactivationReason: z.string().trim().max(200).nullable().optional(),
    priceChangeReason: z.string().trim().max(200).optional(),
    priceValidFrom: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
        "価格適用日を正しく入力してください",
      ),
  })
  .superRefine((data, context) => {
    if (data.salesEndDate && data.salesEndDate < data.salesStartDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salesEndDate"],
        message: "販売終了日は販売開始日以降にしてください",
      });
    }
  });

export type ProductInputValues = z.infer<typeof productInputSchema>;

export function validationErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}
