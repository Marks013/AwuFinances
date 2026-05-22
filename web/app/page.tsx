import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, MessageCircleMore, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { PlanCheckoutLink } from "@/features/billing/components/plan-checkout-link";

const features = [
  {
    title: "Rotina financeira",
    copy: "Contas, cartoes, transacoes, recorrencias e metas no mesmo painel.",
    icon: CreditCard
  },
  {
    title: "Leitura mensal",
    copy: "Relatorios, faturas e categorias com foco em decisao rapida.",
    icon: BarChart3
  },
  {
    title: "WhatsApp",
    copy: "Lancamentos e consultas por mensagem, sempre iniciados pelo usuario.",
    icon: MessageCircleMore
  }
];

export default function HomePage() {
  return (
    <main id="main-content" className="page-shell py-4 md:py-8">
      <section className="surface-strong overflow-hidden rounded-[26px] px-5 py-6 md:px-8 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div className="max-w-3xl space-y-5">
            <BrandMark inverted />
            <div className="eyebrow border-white/18 bg-white/10 text-white">Awu Finances</div>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-5xl">
              Controle financeiro claro para operar todo dia.
            </h1>
            <p className="max-w-2xl text-pretty text-sm leading-7 text-white/82 md:text-base">
              Organize contas, cartoes, metas, faturas e recorrencias em uma experiencia direta, visualmente limpa e
              pronta para uso no desktop ou celular.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login">
                  Entrar
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/planos">Ver planos</Link>
              </Button>
              <Button asChild variant="secondary">
                <PlanCheckoutLink>Assinar Premium</PlanCheckoutLink>
              </Button>
            </div>
          </div>

          <article className="rounded-[22px] border border-white/12 bg-white/10 p-5 text-white">
            <p className="metric-label text-white/72">Premium Completo</p>
            <p className="mt-3 text-balance text-2xl font-semibold leading-tight">WhatsApp, automacoes e limites ampliados.</p>
            <p className="mt-3 text-pretty text-sm leading-6 text-white/78">
              Checkout Mercado Pago com liberacao automatica apos confirmacao do pagamento.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <article key={feature.title} className="surface rounded-[22px] p-5">
              <div className="flex size-10 items-center justify-center rounded-[0.9rem] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-tight text-[var(--color-foreground)]">{feature.title}</h2>
              <p className="mt-2 text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">{feature.copy}</p>
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
    </main>
  );
}
