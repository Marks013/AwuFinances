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

function WhatsAppGlyph() {
  return (
    <svg aria-hidden="true" className="size-7" fill="currentColor" viewBox="0 0 32 32">
      <path d="M16.04 4C9.42 4 4.04 9.31 4.04 15.84c0 2.08.55 4.11 1.59 5.9L4 28l6.42-1.56a12.1 12.1 0 0 0 5.62 1.39c6.62 0 12-5.31 12-11.84S22.66 4 16.04 4Zm0 21.73c-1.75 0-3.47-.46-4.96-1.34l-.36-.21-3.81.93.98-3.61-.24-.38a9.71 9.71 0 0 1-1.5-5.28c0-5.37 4.43-9.74 9.89-9.74s9.89 4.37 9.89 9.74-4.43 9.89-9.89 9.89Zm5.43-7.3c-.3-.15-1.76-.86-2.03-.95-.27-.1-.47-.15-.67.15-.2.29-.77.95-.94 1.15-.17.2-.35.22-.64.07-.3-.15-1.25-.45-2.38-1.45-.88-.77-1.47-1.73-1.64-2.02-.17-.29-.02-.45.13-.6.13-.13.3-.34.45-.51.15-.17.2-.29.3-.49.1-.19.05-.37-.03-.52-.07-.15-.67-1.59-.92-2.18-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.29-1.04 1-1.04 2.44s1.07 2.84 1.22 3.03c.15.2 2.11 3.18 5.12 4.46.72.31 1.28.49 1.72.63.72.23 1.37.2 1.89.12.58-.09 1.76-.71 2-1.39.25-.68.25-1.27.17-1.39-.07-.13-.27-.2-.57-.34Z" />
    </svg>
  );
}

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

      <Link
        aria-label="Abrir WhatsApp financeiro"
        className="fixed bottom-5 right-5 z-[95] inline-flex size-14 items-center justify-center rounded-full border border-white/35 bg-[#25d366] text-white shadow-[0_18px_38px_rgba(9,79,42,0.26)] transition hover:-translate-y-0.5 hover:bg-[#1fbd59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/35"
        href="/dashboard/whatsapp"
        title="Abrir WhatsApp financeiro"
      >
        <WhatsAppGlyph />
      </Link>
    </main>
  );
}
