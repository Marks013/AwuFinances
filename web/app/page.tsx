import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard, MessageCircleMore, ShieldCheck } from "lucide-react";

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
    <main id="main-content" className="home-page page-shell py-4 md:py-8">
      <section className="overflow-hidden rounded-[26px] border border-[#7eb5ae]/45 bg-[#d7e8e5] shadow-[0_28px_80px_rgba(22,54,52,0.22)]">
        <h1 className="sr-only">Awu Finances: economia e financas com controle financeiro diario.</h1>
        <div className="aspect-[4/3] bg-[#519f9d] p-3 sm:aspect-[16/8] sm:p-4 lg:aspect-[16/7]">
          <Image
            src="/brand/home-hero.webp"
            alt="Awu Finances, economias e financas"
            width={1600}
            height={900}
            priority
            sizes="(max-width: 768px) calc(100vw - 32px), 1360px"
            className="h-full w-full rounded-[18px] object-contain object-center shadow-[0_20px_54px_rgba(22,54,52,0.24)]"
          />
        </div>

        <div className="flex flex-wrap gap-3 bg-[#d7e8e5] px-5 py-4 sm:px-6 md:px-8">
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
