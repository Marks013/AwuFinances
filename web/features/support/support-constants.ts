export const supportTopicValues = [
  "technical",
  "financial",
  "account_access",
  "cards_invoices",
  "subscriptions_installments",
  "billing_plan",
  "suggestion",
  "other"
] as const;

export const supportPriorityValues = ["low", "normal", "high", "urgent"] as const;

export const supportTopicLabels: Record<(typeof supportTopicValues)[number], string> = {
  technical: "Suporte técnico",
  financial: "Financeiro",
  account_access: "Conta e acesso",
  cards_invoices: "Cartões e faturas",
  subscriptions_installments: "Assinaturas e parcelamentos",
  billing_plan: "Plano e cobrança",
  suggestion: "Sugestão",
  other: "Outro assunto"
};

export const supportPriorityLabels: Record<(typeof supportPriorityValues)[number], string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};
