import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, MessageCircleMore, ShieldCheck, X } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { PlanCheckoutLink } from "@/features/billing/components/plan-checkout-link";
import { getBillingSettings } from "@/lib/billing/settings";

const planCards = [
  {
    name: "Gratuito",
    label: "Para comecar",
    price: "R$ 0",
    cadence: "sem cobranca",
    href: "/cadastro?plan=free" as Route,
    cta: "Criar conta gratuita",
    features: [
      { label: "1 conta financeira", enabled: true },
      { label: "1 cartao", enabled: true },
      { label: "Transacoes e relatorios", enabled: true },
      { label: "WhatsApp financeiro", enabled: false },
      { label: "Automacoes e PDF", enabled: false }
    ]
  },
  {
    name: "Premium Completo",
    label: "Para uso diario completo",
    price: "Assinatura",
    cadence: "via Mercado Pago",
    href: "/cadastro?plan=pro" as Route,
    cta: "Assinar mensal",
    annualHref: "/cadastro?plan=pro_annual" as Route,
    annualCta: "Pagar anual",
    features: [
      { label: "Contas e cartoes ilimitados", enabled: true },
      { label: "WhatsApp financeiro", enabled: true },
      { label: "Automacoes e recorrencias", enabled: true },
      { label: "Relatorios e PDF", enabled: true },
      { label: "Suporte por chamado", enabled: true }
    ]
  },
  {
    name: "Avaliacao",
    label: "Para testar antes de assinar",
    price: "14 dias",
    cadence: "quando liberado",
    href: "/cadastro?plan=trial" as Route,
    cta: "Criar avaliacao",
    features: [
      { label: "Recursos premium liberados", enabled: true },
      { label: "WhatsApp financeiro", enabled: true },
      { label: "Automacoes e PDF", enabled: true },
      { label: "Cobranca automatica sem contratar", enabled: false }
    ]
  }
];

function formatMoney(amount: number, currencyId: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyId
  }).format(amount);
}

export default async function PlansPage() {
  const billingSettings = await getBillingSettings();
  const premiumMonthlyPrice = formatMoney(billingSettings.monthlyAmount, billingSettings.currencyId);
  const premiumAnnualPrice = formatMoney(billingSettings.annualAmount, billingSettings.currencyId);

  return (
    <main id="main-content" className="page-shell py-6 md:py-10">
      <section className="surface-strong overflow-hidden rounded-[34px] px-6 py-8 md:px-10 md:py-12">
        <div className="section-stack">
          <BrandMark inverted />
          <div className="eyebrow border-white/18 bg-white/10 text-white">Planos</div>
          <h1 className="display-title max-w-4xl text-white">Escolha como quer usar o Awu Finances.</h1>
          <p className="max-w-2xl text-base leading-8 text-white/82 md:text-lg">
            Comece gratis, teste quando houver avaliacao liberada ou assine o Premium para usar WhatsApp, automacoes e
            limites ampliados.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <PlanCheckoutLink>
                Assinar mensal
                <ArrowRight className="size-4" />
              </PlanCheckoutLink>
            </Button>
            <Button asChild variant="secondary">
              <PlanCheckoutLink hrefWhenLoggedIn="/billing?intent=checkout&cycle=annual" hrefWhenLoggedOut="/cadastro?plan=pro_annual">
                Plano anual
              </PlanCheckoutLink>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Ja tenho acesso</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {planCards.map((plan) => {
          const isPremium = plan.name === "Premium Completo";

          return (
            <article key={plan.name} className={isPremium ? "surface-strong rounded-[30px] p-6 text-white" : "surface rounded-[30px] p-6"}>
              <p className={isPremium ? "text-sm font-semibold uppercase tracking-[0.16em] text-white/72" : "eyebrow"}>{plan.label}</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{plan.name}</h2>
              <div className="mt-6">
                <p className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.07em]">
                  {isPremium ? premiumMonthlyPrice : plan.price}
                </p>
                <p className={isPremium ? "text-sm text-white/72" : "text-sm text-[var(--color-muted-foreground)]"}>
                  {isPremium ? `mensal ou ${premiumAnnualPrice} anual` : plan.cadence}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => {
                  const Icon = feature.enabled ? Check : X;

                  return (
                    <div key={feature.label} className="flex items-start gap-3 text-sm leading-6">
                      <span className={feature.enabled ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-muted)_70%,transparent)] text-[var(--color-muted-foreground)]"}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className={isPremium ? "text-white/84" : "text-[var(--color-ink-700)]"}>{feature.label}</span>
                    </div>
                  );
                })}
              </div>

              <Button asChild className="mt-7 w-full" variant={isPremium ? "default" : "secondary"}>
                {isPremium ? (
                  <PlanCheckoutLink>
                    {plan.cta}
                    <ArrowRight className="size-4" />
                  </PlanCheckoutLink>
                ) : (
                  <Link href={plan.href}>
                    {plan.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </Button>
              {isPremium && "annualCta" in plan ? (
                <Button asChild className="mt-3 w-full" variant="secondary">
                  <PlanCheckoutLink hrefWhenLoggedIn="/billing?intent=checkout&cycle=annual" hrefWhenLoggedOut={plan.annualHref}>
                    {plan.annualCta}
                  </PlanCheckoutLink>
                </Button>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="muted-panel">
          <MessageCircleMore className="size-5 text-[var(--color-primary)]" />
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em]">WhatsApp no Premium</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-muted-foreground)]">
            O assistente registra gastos e responde consultas somente quando o usuario inicia a conversa.
          </p>
        </article>
        <article className="muted-panel">
          <ShieldCheck className="size-5 text-[var(--color-primary)]" />
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em]">Checkout seguro</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-muted-foreground)]">
            O Mercado Pago confirma o pagamento e o sistema libera a licenca automaticamente.
          </p>
        </article>
      </section>
    </main>
  );
}
