"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureApiResponse } from "@/lib/observability/http";

type CheckoutPromotion = {
  id: string;
  title: string;
  badge: string;
  description: string;
  couponCode: string;
  discountPercent: number;
  appliesTo: "monthly" | "annual" | "both";
  visibleInCheckout: boolean;
  highlightPriceCard: boolean;
};

type CheckoutClientProps = {
  amount: number | null;
  annualAmount: number | null;
  annualMaxInstallments: number;
  checkoutReturn?: CheckoutReturnSnapshot | null;
  currencyId: string;
  planName: string;
  promotions: CheckoutPromotion[];
  publicKey: string | null;
  initialCycle?: "monthly" | "annual";
  initialIntent?: "checkout" | "manage-card";
};

type CreateSubscriptionPayload = {
  url?: string | null;
  message?: string;
};

type CheckoutReturnSnapshot = {
  status: "approved" | "pending" | "rejected" | "unknown";
  merchantOrderId?: string | null;
  paymentId?: string | null;
  preferenceId?: string | null;
  preapprovalId?: string | null;
};

type CheckoutFeedback = {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
};

type CardPaymentFormData = {
  token?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number | null;
  payer?: unknown;
};

type CardPaymentAdditionalData = {
  bin?: string;
  lastFourDigits?: string;
  cardholderName?: string;
  paymentTypeId?: string;
};

async function createSubscription(body: Record<string, unknown>) {
  const response = await fetch("/api/billing/checkout/create-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao criar assinatura",
    method: "POST",
    path: "/api/billing/checkout/create-subscription"
  });

  return (await response.json()) as CreateSubscriptionPayload;
}

async function createAnnualPayment(body: Record<string, unknown>) {
  const response = await fetch("/api/billing/checkout/create-annual-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao criar checkout anual",
    method: "POST",
    path: "/api/billing/checkout/create-annual-payment"
  });

  return (await response.json()) as CreateSubscriptionPayload;
}

async function updateBillingCard(body: Record<string, unknown>) {
  const response = await fetch("/api/billing/card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao atualizar cartao de cobranca",
    method: "POST",
    path: "/api/billing/card"
  });

  return (await response.json()) as CreateSubscriptionPayload;
}

function formatMoney(amount: number, currencyId: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyId
  }).format(amount);
}

function getFeedbackClassName(tone: CheckoutFeedback["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]";
}

function resolveCheckoutReturnFeedback(checkoutReturn: CheckoutReturnSnapshot): CheckoutFeedback {
  if (checkoutReturn.status === "approved") {
    return {
      tone: "success",
      title: "Pagamento aprovado pelo Mercado Pago",
      description:
        "Recebemos o retorno de aprovacao. A licenca e sincronizada pelo webhook; se o acesso ainda nao mudou, aguarde alguns instantes e confira a tela de licenca."
    };
  }

  if (checkoutReturn.status === "pending") {
    return {
      tone: "warning",
      title: "Pagamento em analise ou aguardando compensacao",
      description:
        "O Mercado Pago retornou um status pendente. Evite pagar novamente agora; acompanhe a licenca e aguarde a confirmacao final do provedor."
    };
  }

  if (checkoutReturn.status === "rejected") {
    return {
      tone: "danger",
      title: "Pagamento nao aprovado",
      description:
        "O provedor recusou ou cancelou a tentativa. Voce pode tentar novamente, revisar os dados do cartao ou escolher o checkout anual com outro meio de pagamento."
    };
  }

  return {
    tone: "info",
    title: "Retorno do Mercado Pago recebido",
    description:
      "O retorno chegou sem um status conclusivo. Mantemos a conferencia pela integracao e exibimos a licenca assim que houver confirmacao segura."
  };
}

function CheckoutFeedbackPanel({
  children,
  feedback
}: {
  children?: ReactNode;
  feedback: CheckoutFeedback;
}) {
  return (
    <div className={`rounded-[1rem] border p-4 text-sm ${getFeedbackClassName(feedback.tone)}`} role="status">
      <p className="font-semibold text-current">{feedback.title}</p>
      <p className="mt-2 leading-6 text-current opacity-80">{feedback.description}</p>
      {children ? <div className="mt-4 flex flex-wrap gap-3">{children}</div> : null}
    </div>
  );
}

export function CheckoutClient({
  amount,
  annualAmount,
  annualMaxInstallments,
  checkoutReturn = null,
  currencyId,
  initialCycle = "monthly",
  initialIntent = "checkout",
  planName,
  promotions,
  publicKey
}: CheckoutClientProps) {
  const queryClient = useQueryClient();
  const annualAutoStartedRef = useRef(false);
  const [isBrickReady, setIsBrickReady] = useState(false);
  const [brickError, setBrickError] = useState<string | null>(null);
  const [brickDiagnostic, setBrickDiagnostic] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState<CheckoutFeedback | null>(null);
  const [formMode, setFormMode] = useState<"subscribe" | "update-card">(
    initialIntent === "manage-card" ? "update-card" : "subscribe"
  );
  const activeCoupon = couponCode.trim().toUpperCase();
  const matchingPromotion = useMemo(
    () =>
      activeCoupon
        ? promotions.find((promotion) => promotion.couponCode.trim().toUpperCase() === activeCoupon) ?? null
        : null,
    [activeCoupon, promotions]
  );
  const monthlyPromotion =
    matchingPromotion && (matchingPromotion.appliesTo === "monthly" || matchingPromotion.appliesTo === "both")
      ? matchingPromotion
      : null;
  const annualPromotion =
    matchingPromotion && (matchingPromotion.appliesTo === "annual" || matchingPromotion.appliesTo === "both")
      ? matchingPromotion
      : null;
  const monthlyCheckoutAmount =
    typeof amount === "number" && monthlyPromotion
      ? Number(Math.max(amount - amount * (monthlyPromotion.discountPercent / 100), 0.01).toFixed(2))
      : amount;
  const annualCheckoutAmount =
    typeof annualAmount === "number" && annualPromotion
      ? Number(Math.max(annualAmount - annualAmount * (annualPromotion.discountPercent / 100), 0.01).toFixed(2))
      : annualAmount;
  const visiblePromotions = promotions.filter((promotion) => promotion.visibleInCheckout);
  const monthlyCardPromotion =
    visiblePromotions.find(
      (promotion) => promotion.highlightPriceCard && (promotion.appliesTo === "monthly" || promotion.appliesTo === "both")
    ) ?? null;
  const annualCardPromotion =
    visiblePromotions.find(
      (promotion) => promotion.highlightPriceCard && (promotion.appliesTo === "annual" || promotion.appliesTo === "both")
    ) ?? null;
  const checkoutReturnFeedback = checkoutReturn ? resolveCheckoutReturnFeedback(checkoutReturn) : null;
  const createSubscriptionMutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Assinatura criada com sucesso");
      setCheckoutFeedback(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] })
      ]);

      window.location.href = payload.url ?? "/license";
    },
    onError: (error) => {
      setCheckoutFeedback({
        tone: "danger",
        title: "Nao foi possivel criar a assinatura mensal",
        description:
          error.message || "O provedor nao confirmou a assinatura. Revise os dados do cartao e tente novamente."
      });
      toast.error(error.message);
    }
  });
  const createAnnualPaymentMutation = useMutation({
    mutationFn: createAnnualPayment,
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Checkout anual iniciado");
      setCheckoutFeedback(null);

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }

      setCheckoutFeedback({
        tone: "warning",
        title: "Checkout anual criado sem URL de redirecionamento",
        description:
          "A tentativa foi registrada, mas o Mercado Pago nao devolveu o link de pagamento. Atualize a pagina e tente novamente antes de criar outra cobranca."
      });
    },
    onError: (error) => {
      setCheckoutFeedback({
        tone: "danger",
        title: "Nao foi possivel abrir o checkout anual",
        description:
          error.message || "A comunicacao com o Mercado Pago falhou antes de gerar o link de pagamento."
      });
      toast.error(error.message);
    }
  });
  const updateCardMutation = useMutation({
    mutationFn: updateBillingCard,
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Cartao atualizado");
      setCheckoutFeedback(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] })
      ]);

      window.location.href = payload.url ?? "/billing";
    },
    onError: (error) => {
      setCheckoutFeedback({
        tone: "danger",
        title: "Nao foi possivel atualizar o cartao",
        description:
          error.message || "O provedor nao confirmou a troca do cartao. Revise os dados e tente novamente."
      });
      toast.error(error.message);
    }
  });

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsBrickReady(false);
      setBrickError(null);
      setBrickDiagnostic(null);
      initMercadoPago(publicKey, {
        locale: "pt-BR"
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [publicKey]);

  useEffect(() => {
    if (initialCycle !== "annual" || annualAutoStartedRef.current || createAnnualPaymentMutation.isPending) {
      return;
    }

    annualAutoStartedRef.current = true;
    createAnnualPaymentMutation.mutate({ couponCode: activeCoupon || null });
  }, [activeCoupon, createAnnualPaymentMutation, initialCycle]);

  useEffect(() => {
    if (!publicKey || typeof monthlyCheckoutAmount !== "number" || monthlyCheckoutAmount <= 0 || isBrickReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      const container = document.getElementById("awu-finances-card-payment-brick");
      const childCount = container?.childElementCount ?? 0;

      if (childCount > 0) {
        setIsBrickReady(true);
        setBrickDiagnostic(null);
        return;
      }

      setBrickDiagnostic("Os campos seguros de pagamento ainda estao carregando. Aguarde alguns instantes ou atualize a pagina.");
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [isBrickReady, monthlyCheckoutAmount, publicKey]);

  const cardPaymentInitialization = useMemo(
    () => ({
      amount: monthlyCheckoutAmount ?? 0
    }),
    [monthlyCheckoutAmount]
  );

  const handleBrickReady = useCallback(() => {
    setIsBrickReady(true);
    setBrickError(null);
  }, []);

  const handleBrickError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Falha ao carregar o checkout do Mercado Pago";
    setBrickError(message);
    toast.error(message);
  }, []);

  const handleSubmit = async (formData: CardPaymentFormData, additionalData?: CardPaymentAdditionalData) => {
    const payload = {
      cardToken: formData.token,
      paymentMethodId: formData.payment_method_id,
      issuerId: formData.issuer_id || null,
      installments: formData.installments ?? null,
      payer: formData.payer ?? null,
      metadata: {
        bin: additionalData?.bin ?? null,
        lastFourDigits: additionalData?.lastFourDigits ?? null,
        cardholderName: additionalData?.cardholderName ?? null,
        paymentTypeId: additionalData?.paymentTypeId ?? null
      }
    };

    if (formMode === "update-card") {
      await updateCardMutation.mutateAsync(payload);
      return;
    }

    await createSubscriptionMutation.mutateAsync({
      ...payload,
      couponCode: activeCoupon || null
    });
  };

  if (!publicKey || typeof amount !== "number" || amount <= 0) {
    return (
      <section className="surface content-section">
        <div className="eyebrow">Checkout</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Checkout ainda não está pronto</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted-foreground)]">
          O ambiente precisa expor chave pública e valor da recorrência para liberar o Brick do Mercado Pago.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => window.location.reload()} type="button">
            Atualizar checkout
          </Button>
          <Button asChild variant="secondary">
            <Link href="/license">Ver status da licenca</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/settings">Voltar ao painel</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface content-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Checkout</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{planName}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted-foreground)]">
            Escolha a forma de pagamento, aplique um cupom se tiver um e conclua a assinatura com segurança pelo Mercado Pago.
          </p>
          {initialCycle === "annual" ? (
            <div className="warning-panel mt-4 text-sm">
              Estamos abrindo o checkout anual no Mercado Pago. Se o navegador bloquear o redirecionamento, use o botao
              do plano anual abaixo.
            </div>
          ) : null}
        </div>
        <Button asChild variant="secondary">
          <Link href="/license">Voltar para licença</Link>
        </Button>
      </div>

      {checkoutReturnFeedback ? (
        <div className="mt-6">
          <CheckoutFeedbackPanel feedback={checkoutReturnFeedback}>
            <Button asChild variant="secondary">
              <Link href="/license">Ver status da licenca</Link>
            </Button>
            <Button onClick={() => window.location.reload()} type="button" variant="secondary">
              Atualizar agora
            </Button>
            {checkoutReturn?.status === "rejected" ? (
              <Button asChild variant="ghost">
                <Link href="/billing?intent=checkout">Tentar novamente</Link>
              </Button>
            ) : null}
          </CheckoutFeedbackPanel>
        </div>
      ) : null}

      {checkoutFeedback ? (
        <div className="mt-6">
          <CheckoutFeedbackPanel feedback={checkoutFeedback}>
            <Button onClick={() => window.location.reload()} type="button" variant="secondary">
              Atualizar checkout
            </Button>
            <Button asChild variant="ghost">
              <Link href="/license">Ver status da licenca</Link>
            </Button>
          </CheckoutFeedbackPanel>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="metric-card">
          <p className="metric-label">Plano</p>
          <p className="metric-value">{planName}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Valor</p>
          <p className="metric-value">{formatMoney(monthlyCheckoutAmount ?? amount, currencyId)}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Cobrança</p>
          <p className="metric-value">Mensal ou anual</p>
        </article>
      </div>

      <div className="data-card mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.65fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold">Cupom de desconto</p>
            <p className="mt-2 text-sm leading-7 text-[var(--color-muted-foreground)]">
              Digite um cupom ou escolha uma promoção disponível. O desconto será conferido antes de finalizar o pagamento.
            </p>
          </div>
          <Input
            aria-label="Cupom de desconto"
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="BLACKFRIDAY"
            value={couponCode}
          />
        </div>
        {visiblePromotions.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visiblePromotions.map((promotion) => (
              <button
                className="rounded-[1rem] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left transition hover:border-[var(--color-primary)]"
                key={promotion.id}
                onClick={() => setCouponCode(promotion.couponCode)}
                type="button"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
                  {promotion.badge}
                </span>
                <span className="mt-2 block text-sm font-semibold text-[var(--color-foreground)]">
                  {promotion.title} • {promotion.discountPercent}% off
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--color-muted-foreground)]">
                  {promotion.description || `Cupom ${promotion.couponCode}`}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {activeCoupon && !matchingPromotion ? (
          <div className="warning-panel mt-4 text-sm">Cupom não encontrado ou indisponível para estes planos.</div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article
          className={
            monthlyCardPromotion
              ? "relative overflow-hidden rounded-[1.5rem] border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-card))] p-5"
              : "data-card p-5"
          }
        >
          {monthlyCardPromotion ? (
            <div className="mb-4 inline-flex rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-foreground)]">
              {monthlyCardPromotion.badge || "Oferta"}
            </div>
          ) : null}
          <p className="text-sm font-semibold">{monthlyCardPromotion?.title || "Mensal recorrente"}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            {formatMoney(monthlyCheckoutAmount ?? amount, currencyId)}
          </p>
          {monthlyPromotion && typeof amount === "number" ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Antes {formatMoney(amount, currencyId)} com cupom {monthlyPromotion.couponCode}.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">
            {monthlyCardPromotion?.description ||
              "Cobrança automática mensal por cartão de crédito. Ideal para começar pagando menos agora."}
          </p>
        </article>

        <article
          className={
            annualCardPromotion
              ? "relative overflow-hidden rounded-[1.5rem] border border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-card))] p-5"
              : "data-card p-5"
          }
        >
          {annualCardPromotion ? (
            <div className="mb-4 inline-flex rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-foreground)]">
              {annualCardPromotion.badge || "Oferta"}
            </div>
          ) : null}
          <p className="text-sm font-semibold">{annualCardPromotion?.title || "Anual sem renovação automática"}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            {typeof annualCheckoutAmount === "number" && annualCheckoutAmount > 0
              ? formatMoney(annualCheckoutAmount, currencyId)
              : "Indisponível"}
          </p>
          {annualPromotion && typeof annualAmount === "number" ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Antes {formatMoney(annualAmount, currencyId)} com cupom {annualPromotion.couponCode}.
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">
            {annualCardPromotion?.description ||
              "Pagamento único para 12 meses de acesso premium, com Pix, boleto, saldo Mercado Pago ou cartão parcelado conforme disponibilidade do Mercado Pago."}
          </p>
          <Button
            className="mt-5 w-full"
            disabled={createAnnualPaymentMutation.isPending || typeof annualCheckoutAmount !== "number" || annualCheckoutAmount <= 0}
            onClick={() => createAnnualPaymentMutation.mutate({ couponCode: activeCoupon || null })}
            type="button"
            variant="secondary"
          >
            {createAnnualPaymentMutation.isPending
              ? "Abrindo checkout anual..."
              : `Pagar anual${annualMaxInstallments > 1 ? ` em ate ${annualMaxInstallments}x` : ""}`}
          </Button>
        </article>
      </div>

      <div className="data-card mt-6 p-5">
        <div className="mb-5 flex flex-wrap gap-3">
          <Button
            onClick={() => setFormMode("subscribe")}
            type="button"
            variant={formMode === "subscribe" ? "default" : "secondary"}
          >
            Assinar mensal
          </Button>
          <Button
            onClick={() => setFormMode("update-card")}
            type="button"
            variant={formMode === "update-card" ? "default" : "secondary"}
          >
            Trocar cartao
          </Button>
        </div>
        <div className="mb-5">
          <p className="text-sm font-semibold">
            {formMode === "update-card" ? "Trocar cartao de cobranca" : "Assinar mensal com cartao"}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {formMode === "update-card"
              ? "Use este formulario para substituir o cartao da assinatura recorrente ativa."
              : "Use este formulario apenas para a assinatura mensal recorrente."}
          </p>
        </div>
        {!isBrickReady ? (
          <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted-foreground)]">
            Carregando campos seguros do Mercado Pago...
          </div>
        ) : null}
        {brickError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Nao foi possivel carregar os campos seguros</p>
            <p className="mt-2 leading-6">{brickError}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()} type="button" variant="secondary">
                Recarregar checkout
              </Button>
              <Button asChild variant="ghost">
                <Link href="/license">Ver licenca</Link>
              </Button>
            </div>
          </div>
        ) : null}
        {brickDiagnostic ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Campos de pagamento demorando para carregar</p>
            <p className="mt-2 leading-6">{brickDiagnostic}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()} type="button" variant="secondary">
                Tentar recarregar
              </Button>
              <Button
                disabled={createAnnualPaymentMutation.isPending || typeof annualCheckoutAmount !== "number" || annualCheckoutAmount <= 0}
                onClick={() => createAnnualPaymentMutation.mutate({ couponCode: activeCoupon || null })}
                type="button"
                variant="ghost"
              >
                Usar checkout anual
              </Button>
            </div>
          </div>
        ) : null}
        <div className="min-h-[520px]">
        <CardPayment
          id="awu-finances-card-payment-brick"
          initialization={cardPaymentInitialization}
          locale="pt-BR"
          onError={handleBrickError}
          onReady={handleBrickReady}
          onSubmit={handleSubmit}
        />
        </div>
      </div>

      {createSubscriptionMutation.isPending ? (
        <div className="muted-panel mt-5 text-sm text-[var(--color-muted-foreground)]">
          Criando assinatura e sincronizando a licença da conta...
        </div>
      ) : null}
      {createAnnualPaymentMutation.isPending ? (
        <div className="muted-panel mt-5 text-sm text-[var(--color-muted-foreground)]">
          Criando checkout anual no Mercado Pago...
        </div>
      ) : null}
      {updateCardMutation.isPending ? (
        <div className="muted-panel mt-5 text-sm text-[var(--color-muted-foreground)]">
          Atualizando cartao da assinatura...
        </div>
      ) : null}
    </section>
  );
}
