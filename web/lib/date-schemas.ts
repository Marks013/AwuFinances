import { z } from "zod";

import { isRealDateKey } from "@/lib/date";

export const dateKeySchema = z.string().refine(isRealDateKey, "Data invalida");
export const optionalDateKeySchema = z.preprocess(
  (value) => (value === "" ? null : value),
  dateKeySchema.optional().nullable()
);
