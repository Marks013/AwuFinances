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
    <main id="main-content" className="page-shell py-6 md:py-10">
      <section className="surface-strong overflow-hidden rounded-[34px] px-6 py-8 md:px-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div className="section-stack">
            <BrandMark inverted />
            <div className="eyebrow border-white/18 bg-white/10 text-white">Awu Finances</div>
            <h1 className="display-title max-w-4xl text-white">Controle financeiro claro para operar todo dia.</h1>
            <p className="max-w-2xl text-base leading-8 text-white/82 md:text-lg">
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

          <article className="rounded-[28px] border border-white/12 bg-white/10 p-5 text-white">
            <p className="metric-label text-white/72">Premium Completo</p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">WhatsApp, automacoes e limites ampliados.</p>
            <p className="mt-4 text-sm leading-7 text-white/78">
              Checkout Mercado Pago com liberacao automatica apos confirmacao do pagamento.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <article key={feature.title} className="surface content-section">
              <div className="flex size-11 items-center justify-center rounded-[1rem] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">{feature.copy}</p>
            </article>
          );
        })}
      </section>

      <section className="surface mt-6 rounded-[30px] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow">Seguranca e privacidade</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Dados isolados por carteira e acesso protegido.</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">
              O produto opera por assinatura, com contas separadas, controles de acesso e historico para rotinas sensiveis.
            </p>
          </div>
          <ShieldCheck className="size-10 text-[var(--color-primary)]" />
        </div>
      </section>
    </main>
  );
}
