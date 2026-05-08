import type { FieldErrors as HookFormFieldErrors, FieldValues, Resolver } from "react-hook-form";

import type { AccountFormValues } from "@/features/accounts/schemas/account-schema";
import type { LoginSchema } from "@/features/auth/schemas/login-schema";
import type { CardFormValues } from "@/features/cards/schemas/card-schema";
import type { CategoryFormValues } from "@/features/categories/schemas/category-schema";
import type { GoalFormValues } from "@/features/goals/schemas/goal-schema";
import type { InstallmentGroupUpdateValues } from "@/features/installments/schemas/installment-schema";
import type {
  AcceptInvitationValues,
  ForgotPasswordValues,
  InvitationValues,
  PublicRegistrationValues,
  ResetPasswordValues
} from "@/features/password/schemas/password-schema";
import { supportPriorityValues, supportTopicValues } from "@/features/support/support-constants";
import type { SupportRequestValues } from "@/features/support/schemas/support-schema";
import type { SubscriptionFormValues } from "@/features/subscriptions/schemas/subscription-schema";
import type { TransactionFormValues } from "@/features/transactions/schemas/transaction-schema";
import { isRealDateKey, normalizeCalendarDate } from "@/lib/date";

const MAX_DECIMAL_15_2 = 9_999_999_999_999.99;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

type FieldErrors = Record<string, string>;
type ValidationResult<TValues> = {
  values: TValues;
  errors: FieldErrors;
};

export type BenefitWalletValues = {
  name: string;
  balance: number;
};

export type BenefitRechargeValues = {
  date: string;
  amount: number;
  description: string;
  paymentMethod: "pix" | "money";
  applyTithe: boolean;
};

export type BenefitConsumeValues = {
  date: string;
  amount: number;
  description: string;
  paymentMethod: "pix" | "money" | "debit_card";
  categoryId: string;
};

export type BenefitRecurringRechargeValues = {
  name: string;
  amount: number;
  billingDay: number;
  nextBillingDate: string;
  autoTithe: boolean;
};

export type SharingInviteValues = {
  name: string;
  email: string;
};

function createResolver<TValues extends FieldValues>(
  validate: (rawValues: Record<string, unknown>) => ValidationResult<TValues>
): Resolver<TValues> {
  return (async (rawValues: TValues) => {
    const result = validate(rawValues);

    if (Object.keys(result.errors).length > 0) {
      return {
        values: {},
        errors: Object.fromEntries(
          Object.entries(result.errors).map(([name, message]) => [name, { type: "validate", message }])
        ) as HookFormFieldErrors<TValues>
      };
    }

    return {
      values: result.values,
      errors: {}
    };
  }) as Resolver<TValues>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function trimmedString(value: unknown) {
  return stringValue(value).trim();
}

function nullableTrimmedString(value: unknown) {
  if (value == null) {
    return value as null | undefined;
  }

  return trimmedString(value);
}

function numberValue(value: unknown, fallback?: number) {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  return Number(value);
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function enumValue<const TValues extends readonly string[]>(value: unknown, allowed: TValues, fallback?: TValues[number]) {
  return allowed.includes(value as TValues[number]) ? (value as TValues[number]) : fallback;
}

function normalizeTokenValue(value: unknown) {
  const normalized = trimmedString(value);

  if (!normalized) {
    return normalized;
  }

  const tokenParamMatch = normalized.match(/[?&]token=([a-f0-9]+)/i);
  if (tokenParamMatch?.[1]) {
    return tokenParamMatch[1];
  }

  const tokenMatch = normalized.match(/\b[a-f0-9]{48}\b/i);
  return tokenMatch?.[0] ?? normalized;
}

function passwordError(value: string) {
  if (value.length < 8) {
    return "Minimo de 8 caracteres";
  }

  if (value.length > 128) {
    return "Senha muito longa";
  }

  return null;
}

function addStringMinError(errors: FieldErrors, field: string, value: string, min: number, message: string) {
  if (value.length < min) {
    errors[field] = message;
  }
}

function addEmailError(errors: FieldErrors, field: string, value: string, message = "Informe um e-mail valido") {
  if (!EMAIL_PATTERN.test(value)) {
    errors[field] = message;
  }
}

function addNumberRangeError(errors: FieldErrors, field: string, value: number, options: { min?: number; max?: number; message: string }) {
  if (!Number.isFinite(value) || (options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
    errors[field] = options.message;
  }
}

function addPositiveError(errors: FieldErrors, field: string, value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) {
    errors[field] = message;
  }
}

function addIntegerRangeError(
  errors: FieldErrors,
  field: string,
  value: number,
  options: { min: number; max: number; message?: string }
) {
  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    errors[field] = options.message ?? `Informe um valor entre ${options.min} e ${options.max}`;
  }
}

function addDateKeyError(errors: FieldErrors, field: string, value: string, message: string) {
  if (!DATE_KEY_PATTERN.test(value) || !isRealDateKey(value)) {
    errors[field] = message;
  }
}

function optionalDateKey(value: unknown) {
  const normalized = trimmedString(value);
  return normalized === "" ? null : normalized;
}

function parseTransactionDate(value: unknown, errors: FieldErrors) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      errors.date = "Data invalida";
      return value;
    }

    return normalizeCalendarDate(value);
  }

  const dateKey = trimmedString(value);
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    errors.date = "Data invalida. Use YYYY-MM-DD";
    return new Date(NaN);
  }

  if (!isRealDateKey(dateKey)) {
    errors.date = "Data inexistente";
    return new Date(NaN);
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return normalizeCalendarDate(new Date(Date.UTC(year, month - 1, day)));
}

function deriveStatementMonthAnchor(closeDay: number, dueDay: number) {
  return closeDay < dueDay ? "previous_month" : "close_month";
}

export const accountFormResolver = createResolver<AccountFormValues>((raw) => {
  const errors: FieldErrors = {};
  const values: AccountFormValues = {
    name: trimmedString(raw.name),
    type: enumValue(raw.type, ["checking", "savings", "investment", "wallet"] as const, "checking") ?? "checking",
    usage: enumValue(raw.usage, ["standard", "benefit_food"] as const, "standard") ?? "standard",
    balance: numberValue(raw.balance, 0),
    currency: trimmedString(raw.currency || "BRL"),
    color: stringValue(raw.color || "#10B981"),
    institution: nullableTrimmedString(raw.institution)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addNumberRangeError(errors, "balance", values.balance, {
    min: -MAX_DECIMAL_15_2,
    max: MAX_DECIMAL_15_2,
    message: "Informe um saldo valido"
  });

  if (values.currency.length !== 3) {
    errors.currency = "Informe uma moeda valida";
  }

  if (!HEX_COLOR_PATTERN.test(values.color)) {
    errors.color = "Cor invalida";
  }

  if (values.usage === "benefit_food" && values.type !== "wallet") {
    errors.type = "Vale Alimentacao deve usar o tipo carteira";
  }

  return { values, errors };
});

export const cardFormResolver = createResolver<CardFormValues>((raw) => {
  const errors: FieldErrors = {};
  const dueDay = numberValue(raw.dueDay, 10);
  const closeDay = numberValue(raw.closeDay, 3);
  const values: CardFormValues = {
    name: trimmedString(raw.name),
    brand: trimmedString(raw.brand),
    last4: trimmedString(raw.last4),
    limitAmount: numberValue(raw.limitAmount, 0),
    dueDay,
    closeDay,
    statementMonthAnchor: deriveStatementMonthAnchor(closeDay, dueDay),
    color: stringValue(raw.color || "#374151"),
    institution: nullableTrimmedString(raw.institution)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addStringMinError(errors, "brand", values.brand, 2, "Informe a bandeira");

  if (!/^\d{0,4}$/.test(values.last4)) {
    errors.last4 = "Use ate 4 digitos";
  }

  addNumberRangeError(errors, "limitAmount", values.limitAmount, {
    min: 0,
    max: MAX_DECIMAL_15_2,
    message: "Informe um limite valido"
  });
  addIntegerRangeError(errors, "dueDay", values.dueDay, { min: 1, max: 31 });
  addIntegerRangeError(errors, "closeDay", values.closeDay, { min: 1, max: 31 });

  if (!HEX_COLOR_PATTERN.test(values.color)) {
    errors.color = "Cor invalida";
  }

  return { values, errors };
});

export const categoryFormResolver = createResolver<CategoryFormValues>((raw) => {
  const errors: FieldErrors = {};
  const values: CategoryFormValues = {
    name: trimmedString(raw.name),
    icon: trimmedString(raw.icon || "tag"),
    color: stringValue(raw.color || "#6B7280"),
    type: enumValue(raw.type, ["income", "expense"] as const, "expense") ?? "expense",
    monthlyLimit: raw.monthlyLimit == null ? null : numberValue(raw.monthlyLimit),
    keywords: stringValue(raw.keywords)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addStringMinError(errors, "icon", values.icon, 1, "Informe um icone");

  if (!HEX_COLOR_PATTERN.test(values.color)) {
    errors.color = "Cor invalida";
  }

  if (values.monthlyLimit != null) {
    addNumberRangeError(errors, "monthlyLimit", values.monthlyLimit, {
      min: 0,
      max: MAX_DECIMAL_15_2,
      message: "Informe um limite válido"
    });
  }

  return { values, errors };
});

export const goalFormResolver = createResolver<GoalFormValues>((raw) => {
  const errors: FieldErrors = {};
  const deadline = optionalDateKey(raw.deadline);
  const values: GoalFormValues = {
    name: trimmedString(raw.name),
    targetAmount: numberValue(raw.targetAmount),
    currentAmount: numberValue(raw.currentAmount, 0),
    deadline,
    color: stringValue(raw.color || "#3B82F6"),
    icon: nullableTrimmedString(raw.icon),
    accountId: raw.accountId == null ? raw.accountId : stringValue(raw.accountId)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addPositiveError(errors, "targetAmount", values.targetAmount, "Informe um valor alvo");
  addNumberRangeError(errors, "currentAmount", values.currentAmount, { min: 0, message: "Informe um valor atual valido" });

  if (deadline && !isRealDateKey(deadline)) {
    errors.deadline = "Data invalida";
  }

  if (!HEX_COLOR_PATTERN.test(values.color)) {
    errors.color = "Cor invalida";
  }

  return { values, errors };
});

export const installmentGroupUpdateResolver = createResolver<InstallmentGroupUpdateValues>((raw) => {
  const errors: FieldErrors = {};
  const amount = raw.amount === undefined || raw.amount === "" ? undefined : numberValue(raw.amount);
  const values: InstallmentGroupUpdateValues = {
    description: trimmedString(raw.description),
    amount,
    categoryId: raw.categoryId == null ? raw.categoryId : stringValue(raw.categoryId),
    notes: raw.notes == null ? raw.notes : stringValue(raw.notes)
  };

  addStringMinError(errors, "description", values.description, 3, "Informe uma descricao");

  if (amount !== undefined) {
    addPositiveError(errors, "amount", amount, "Informe um valor maior que zero");
  }

  return { values, errors };
});

export const loginFormResolver = createResolver<LoginSchema>((raw) => {
  const errors: FieldErrors = {};
  const values: LoginSchema = {
    email: trimmedString(raw.email),
    password: stringValue(raw.password)
  };

  addEmailError(errors, "email", values.email);

  if (values.password.length < 8) {
    errors.password = "Informe ao menos 8 caracteres";
  }

  return { values, errors };
});

export const forgotPasswordResolver = createResolver<ForgotPasswordValues>((raw) => {
  const errors: FieldErrors = {};
  const values: ForgotPasswordValues = {
    email: trimmedString(raw.email)
  };

  addEmailError(errors, "email", values.email);
  return { values, errors };
});

export const resetPasswordResolver = createResolver<ResetPasswordValues>((raw) => {
  const errors: FieldErrors = {};
  const values: ResetPasswordValues = {
    token: normalizeTokenValue(raw.token),
    newPassword: stringValue(raw.newPassword),
    confirmPassword: stringValue(raw.confirmPassword)
  };

  if (!values.token) {
    errors.token = "Token obrigatorio";
  }

  const newPasswordError = passwordError(values.newPassword);
  if (newPasswordError) {
    errors.newPassword = newPasswordError;
  }

  const confirmPasswordError = passwordError(values.confirmPassword);
  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  } else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = "As senhas nao conferem";
  }

  return { values, errors };
});

export const invitationResolver = createResolver<InvitationValues>((raw) => {
  const errors: FieldErrors = {};
  const values: InvitationValues = {
    email: trimmedString(raw.email),
    name: stringValue(raw.name),
    role: enumValue(raw.role, ["admin", "member"] as const, "admin") ?? "admin"
  };

  addEmailError(errors, "email", values.email);
  addStringMinError(errors, "name", values.name, 2, "Informe o nome do usuario");
  return { values, errors };
});

export const sharingInviteResolver = createResolver<SharingInviteValues>((raw) => {
  const errors: FieldErrors = {};
  const values: SharingInviteValues = {
    name: stringValue(raw.name),
    email: trimmedString(raw.email)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe o nome do usuario");
  addEmailError(errors, "email", values.email);
  return { values, errors };
});

export const acceptInvitationResolver = createResolver<AcceptInvitationValues>((raw) => {
  const errors: FieldErrors = {};
  const values: AcceptInvitationValues = {
    token: normalizeTokenValue(raw.token),
    name: stringValue(raw.name),
    password: stringValue(raw.password),
    confirmPassword: stringValue(raw.confirmPassword),
    acceptTermsOfUse: booleanValue(raw.acceptTermsOfUse),
    acceptPrivacyPolicy: booleanValue(raw.acceptPrivacyPolicy)
  };

  if (!values.token) {
    errors.token = "Token obrigatorio";
  }

  addStringMinError(errors, "name", values.name, 2, "Informe seu nome");

  const passwordValidationError = passwordError(values.password);
  if (passwordValidationError) {
    errors.password = passwordValidationError;
  }

  const confirmPasswordValidationError = passwordError(values.confirmPassword);
  if (confirmPasswordValidationError) {
    errors.confirmPassword = confirmPasswordValidationError;
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "As senhas nao conferem";
  }

  if (!values.acceptTermsOfUse) {
    errors.acceptTermsOfUse = "Voce precisa aceitar os Termos de Uso";
  }

  if (!values.acceptPrivacyPolicy) {
    errors.acceptPrivacyPolicy = "Voce precisa aceitar a Politica de Privacidade";
  }

  return { values, errors };
});

export const publicRegistrationResolver = createResolver<PublicRegistrationValues>((raw) => {
  const errors: FieldErrors = {};
  const values: PublicRegistrationValues = {
    plan: enumValue(raw.plan, ["free", "trial", "pro", "pro_annual"] as const, "free") ?? "free",
    name: stringValue(raw.name),
    organizationName: stringValue(raw.organizationName),
    email: trimmedString(raw.email),
    password: stringValue(raw.password),
    confirmPassword: stringValue(raw.confirmPassword),
    acceptTermsOfUse: booleanValue(raw.acceptTermsOfUse),
    acceptPrivacyPolicy: booleanValue(raw.acceptPrivacyPolicy)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe seu nome");
  addStringMinError(errors, "organizationName", values.organizationName, 2, "Informe o nome da conta");
  addEmailError(errors, "email", values.email);

  const passwordValidationError = passwordError(values.password);
  if (passwordValidationError) {
    errors.password = passwordValidationError;
  }

  const confirmPasswordValidationError = passwordError(values.confirmPassword);
  if (confirmPasswordValidationError) {
    errors.confirmPassword = confirmPasswordValidationError;
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "As senhas nao conferem";
  }

  if (!values.acceptTermsOfUse) {
    errors.acceptTermsOfUse = "Voce precisa aceitar os Termos de Uso";
  }

  if (!values.acceptPrivacyPolicy) {
    errors.acceptPrivacyPolicy = "Voce precisa aceitar a Politica de Privacidade";
  }

  return { values, errors };
});

export const subscriptionFormResolver = createResolver<SubscriptionFormValues>((raw) => {
  const errors: FieldErrors = {};
  const values: SubscriptionFormValues = {
    name: trimmedString(raw.name),
    amount: numberValue(raw.amount),
    billingDay: numberValue(raw.billingDay, 1),
    categoryId: raw.categoryId == null ? raw.categoryId : stringValue(raw.categoryId),
    accountId: raw.accountId == null ? raw.accountId : stringValue(raw.accountId),
    cardId: raw.cardId == null ? raw.cardId : stringValue(raw.cardId),
    nextBillingDate: trimmedString(raw.nextBillingDate),
    type: enumValue(raw.type, ["income", "expense"] as const, "expense") ?? "expense",
    isActive: booleanValue(raw.isActive, true),
    autoTithe: booleanValue(raw.autoTithe)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addPositiveError(errors, "amount", values.amount, "Informe um valor");
  addIntegerRangeError(errors, "billingDay", values.billingDay, { min: 1, max: 31 });
  addDateKeyError(errors, "nextBillingDate", values.nextBillingDate, "Data invalida");

  if (values.type === "income" && values.cardId) {
    errors.cardId = "Receitas recorrentes nao devem ser vinculadas a cartao";
  }

  if (values.cardId && values.accountId) {
    errors.accountId = "Assinaturas no credito devem ficar vinculadas ao cartao, nao a conta";
  }

  if (!values.cardId && !values.accountId) {
    errors.accountId = "Selecione a conta vinculada a assinatura";
  }

  return { values, errors };
});

export const supportRequestResolver = createResolver<SupportRequestValues>((raw) => {
  const errors: FieldErrors = {};
  const values: SupportRequestValues = {
    topic: enumValue(raw.topic, supportTopicValues, "technical") ?? "technical",
    priority: enumValue(raw.priority, supportPriorityValues, "normal") ?? "normal",
    subject: trimmedString(raw.subject),
    message: trimmedString(raw.message),
    contactEmail: trimmedString(raw.contactEmail),
    contactName: trimmedString(raw.contactName),
    allowAccountContext: booleanValue(raw.allowAccountContext, true)
  };

  addStringMinError(errors, "subject", values.subject, 6, "Descreva o assunto com um pouco mais de detalhe");
  if (values.subject.length > 120) {
    errors.subject = "Assunto muito longo";
  }

  addStringMinError(errors, "message", values.message, 30, "Explique o que aconteceu com pelo menos 30 caracteres");
  if (values.message.length > 5000) {
    errors.message = "Mensagem muito longa";
  }

  addEmailError(errors, "contactEmail", values.contactEmail, "Informe um e-mail válido");
  if (values.contactEmail.length > 160) {
    errors.contactEmail = "Informe um e-mail válido";
  }

  addStringMinError(errors, "contactName", values.contactName, 2, "Informe seu nome");
  if (values.contactName.length > 100) {
    errors.contactName = "Informe seu nome";
  }

  return { values, errors };
});

export const transactionFormResolver = createResolver<TransactionFormValues>((raw) => {
  const errors: FieldErrors = {};
  const date = parseTransactionDate(raw.date, errors);
  const values: TransactionFormValues = {
    date,
    amount: numberValue(raw.amount),
    description: trimmedString(raw.description),
    type: enumValue(raw.type, ["income", "expense", "transfer"] as const, "expense") ?? "expense",
    paymentMethod: enumValue(raw.paymentMethod, ["pix", "money", "credit_card", "debit_card", "transfer"] as const, "pix") ?? "pix",
    categoryId: raw.categoryId == null ? raw.categoryId : stringValue(raw.categoryId),
    accountId: raw.accountId == null ? raw.accountId : stringValue(raw.accountId),
    destinationAccountId: raw.destinationAccountId == null ? raw.destinationAccountId : stringValue(raw.destinationAccountId),
    cardId: raw.cardId == null ? raw.cardId : stringValue(raw.cardId),
    notes: raw.notes == null ? raw.notes : stringValue(raw.notes),
    installments: numberValue(raw.installments, 1),
    competence: raw.competence === undefined ? undefined : stringValue(raw.competence),
    applyTithe: booleanValue(raw.applyTithe)
  };

  addPositiveError(errors, "amount", values.amount, "Informe um valor maior que zero");
  if (values.amount > MAX_DECIMAL_15_2) {
    errors.amount = "Valor excede o limite permitido";
  }

  addStringMinError(errors, "description", values.description, 3, "Informe uma descricao");
  addIntegerRangeError(errors, "installments", values.installments, { min: 1, max: 120 });

  if (values.competence && !MONTH_KEY_PATTERN.test(values.competence)) {
    errors.competence = "Formato invalido. Use YYYY-MM";
  }

  if (values.type !== "income" && values.applyTithe) {
    errors.applyTithe = "O dizimo automatico so pode ser marcado em receitas";
  }

  if (values.type === "transfer" && !values.accountId) {
    errors.accountId = "Selecione a conta de origem da transferencia";
  }

  if (values.type === "transfer" && !values.destinationAccountId) {
    errors.destinationAccountId = "Selecione a conta de destino da transferencia";
  }

  if (values.type === "transfer" && values.accountId && values.destinationAccountId && values.accountId === values.destinationAccountId) {
    errors.destinationAccountId = "A conta de destino deve ser diferente da conta de origem";
  }

  if (values.type === "transfer" && values.cardId) {
    errors.cardId = "Transferencia nao deve ser vinculada a cartao";
  }

  if (values.type !== "transfer" && values.destinationAccountId) {
    errors.destinationAccountId = "Conta de destino e usada apenas em transferencias";
  }

  if (values.paymentMethod === "credit_card" && !values.cardId) {
    errors.cardId = "Selecione o cartao para lancamentos no credito";
  }

  if (values.paymentMethod === "credit_card" && values.accountId) {
    errors.accountId = "Compras no credito devem ficar vinculadas ao cartao, nao a conta";
  }

  if (values.paymentMethod !== "credit_card" && values.cardId) {
    errors.cardId = "Selecione cartao apenas para compras no credito";
  }

  if (values.type !== "transfer" && values.paymentMethod !== "credit_card" && !values.accountId) {
    errors.accountId = "Selecione a conta vinculada ao lancamento";
  }

  if (values.cardId && values.installments > 1 && values.paymentMethod !== "credit_card") {
    errors.paymentMethod = "Parcelamento exige cartao de credito";
  }

  return { values, errors };
});

export const benefitWalletResolver = createResolver<BenefitWalletValues>((raw) => {
  const errors: FieldErrors = {};
  const values: BenefitWalletValues = {
    name: trimmedString(raw.name),
    balance: numberValue(raw.balance, 0)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addNumberRangeError(errors, "balance", values.balance, { min: 0, message: "Informe um saldo valido" });
  return { values, errors };
});

export const benefitRechargeResolver = createResolver<BenefitRechargeValues>((raw) => {
  const errors: FieldErrors = {};
  const values: BenefitRechargeValues = {
    date: stringValue(raw.date),
    amount: numberValue(raw.amount),
    description: trimmedString(raw.description),
    paymentMethod: enumValue(raw.paymentMethod, ["pix", "money"] as const, "pix") ?? "pix",
    applyTithe: booleanValue(raw.applyTithe)
  };

  addDateKeyError(errors, "date", values.date, "Informe uma data");
  addPositiveError(errors, "amount", values.amount, "Informe um valor");
  addStringMinError(errors, "description", values.description, 2, "Informe uma descrição");
  return { values, errors };
});

export const benefitConsumeResolver = createResolver<BenefitConsumeValues>((raw) => {
  const errors: FieldErrors = {};
  const values: BenefitConsumeValues = {
    date: stringValue(raw.date),
    amount: numberValue(raw.amount),
    description: trimmedString(raw.description),
    paymentMethod: enumValue(raw.paymentMethod, ["pix", "money", "debit_card"] as const, "debit_card") ?? "debit_card",
    categoryId: trimmedString(raw.categoryId)
  };

  addDateKeyError(errors, "date", values.date, "Informe uma data");
  addPositiveError(errors, "amount", values.amount, "Informe um valor");
  addStringMinError(errors, "description", values.description, 2, "Informe uma descrição");
  return { values, errors };
});

export const benefitRecurringRechargeResolver = createResolver<BenefitRecurringRechargeValues>((raw) => {
  const errors: FieldErrors = {};
  const values: BenefitRecurringRechargeValues = {
    name: trimmedString(raw.name),
    amount: numberValue(raw.amount),
    billingDay: numberValue(raw.billingDay, 5),
    nextBillingDate: stringValue(raw.nextBillingDate),
    autoTithe: booleanValue(raw.autoTithe)
  };

  addStringMinError(errors, "name", values.name, 2, "Informe um nome");
  addPositiveError(errors, "amount", values.amount, "Informe um valor");
  addIntegerRangeError(errors, "billingDay", values.billingDay, { min: 1, max: 31 });
  addDateKeyError(errors, "nextBillingDate", values.nextBillingDate, "Informe a próxima data");
  return { values, errors };
});
