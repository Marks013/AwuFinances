import { z } from "zod";

import {
  supportPriorityLabels,
  supportPriorityValues,
  supportTopicLabels,
  supportTopicValues
} from "@/features/support/support-constants";

export { supportPriorityLabels, supportPriorityValues, supportTopicLabels, supportTopicValues };

export const supportRequestSchema = z.object({
  topic: z.enum(supportTopicValues),
  priority: z.enum(supportPriorityValues).default("normal"),
  subject: z.string().trim().min(6, "Descreva o assunto com um pouco mais de detalhe").max(120, "Assunto muito longo"),
  message: z.string().trim().min(30, "Explique o que aconteceu com pelo menos 30 caracteres").max(5000, "Mensagem muito longa"),
  contactEmail: z.string().trim().email("Informe um e-mail válido").max(160),
  contactName: z.string().trim().min(2, "Informe seu nome").max(100),
  allowAccountContext: z.boolean().default(true)
});

export type SupportRequestValues = z.infer<typeof supportRequestSchema>;
