import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";

import { FloatingWhatsAppAssistant } from "@/components/home/floating-whatsapp-assistant";
import { Button } from "@/components/ui/button";
import { PlanCheckoutLink } from "@/features/billing/components/plan-checkout-link";
import { getBillingSettings } from "@/lib/billing/settings";
import { cn } from "@/lib/utils";

const planCards = [
  {
    name: "Gratuito",
    tone: "free",
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
    tone: "premium",
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
    tone: "trial",
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
] as const;

function formatMoney(amount: number, currencyId: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyId
  }).format(amount);
}

export default async function HomePage() {
  const billingSettings = await getBillingSettings();
  const premiumMonthlyPrice = formatMoney(billingSettings.monthlyAmount, billingSettings.currencyId);
  const premiumAnnualPrice = formatMoney(billingSettings.annualAmount, billingSettings.currencyId);

  return (
    <main id="main-content" className="home-page page-shell py-4 md:py-8">
      <section className="overflow-hidden rounded-[26px] border border-[#7eb5ae]/45 bg-[#d7e8e5] shadow-[0_28px_80px_rgba(22,54,52,0.22)]">
        <h1 className="sr-only">Awu Finances: economia e financas com controle financeiro diario.</h1>
        <div className="relative isolate aspect-[16/9] overflow-hidden bg-[#519f9d]">
          <video
            aria-label="Awu Finances, economias e financas"
            autoPlay
            className="relative z-0 h-full w-full object-cover object-center"
            loop
            muted
            playsInline
            poster="/brand/home-hero.webp"
            preload="metadata"
          >
            <source src="/brand/home-hero.mp4" type="video/mp4" />
          </video>

          <div className="home-hero-actions absolute bottom-[8.5%] left-[8.9%] z-10 flex flex-wrap gap-3 max-[520px]:bottom-4 max-[520px]:left-4 max-[520px]:right-4">
            <Button asChild>
              <Link href="/login">
                Entrar
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-transparent bg-[#122325] text-white shadow-[0_12px_28px_rgba(18,35,37,0.16)] hover:bg-[#183032]"
            >
              <Link href="/planos">Ver planos</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-transparent bg-[#122325] text-white shadow-[0_12px_28px_rgba(18,35,37,0.16)] hover:bg-[#183032]"
            >
              <PlanCheckoutLink>Assinar Premium</PlanCheckoutLink>
            </Button>
          </div>
        </div>
      </section>

      <section className="home-plans-grid mt-4 grid gap-4 xl:grid-cols-3">
        {planCards.map((plan) => {
          const isPremium = plan.tone === "premium";

          return (
            <article key={plan.name} className={cn("home-plan-card", `home-plan-card--${plan.tone}`)}>
              <p className="home-plan-badge">{plan.label}</p>
              <h2 className="mt-4 text-balance text-xl font-semibold leading-tight">{plan.name}</h2>
              <div className="mt-5">
                <p className="home-plan-price">{isPremium ? premiumMonthlyPrice : plan.price}</p>
                <p className="home-plan-cadence">
                  {isPremium ? `mensal ou ${premiumAnnualPrice} anual` : plan.cadence}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => {
                  const Icon = feature.enabled ? Check : X;

                  return (
                    <div key={feature.label} className="home-plan-feature">
                      <span
                        className={cn(
                          "home-plan-feature-icon",
                          feature.enabled ? "home-plan-feature-icon--yes" : "home-plan-feature-icon--no"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span>{feature.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="home-plan-actions">
                <Button asChild className="home-plan-action" variant={isPremium ? "default" : "secondary"}>
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
                  <Button asChild className="home-plan-action home-plan-action--secondary mt-3" variant="secondary">
                    <PlanCheckoutLink hrefWhenLoggedIn="/billing?intent=checkout&cycle=annual" hrefWhenLoggedOut={plan.annualHref}>
                      {plan.annualCta}
                    </PlanCheckoutLink>
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="surface mt-4 rounded-[24px] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow">Seguranca e privacidade</div>
            <h2 className="mt-3 text-balance text-xl font-semibold leading-tight">Dados isolados por carteira e acesso protegido.</h2>
            <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
              O produto opera por assinatura, com contas separadas, controles de acesso e historico para rotinas sensiveis.
            </p>
          </div>
          <ShieldCheck className="size-10 text-[var(--color-primary)]" />
        </div>
      </section>

      <FloatingWhatsAppAssistant />
    </main>
  );
}
