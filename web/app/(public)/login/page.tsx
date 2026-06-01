import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, BellRing, MessageCircle, ShieldCheck } from "lucide-react";

import { AwuMascot } from "@/components/brand/awu-mascot";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/features/auth/components/login-form";
import { PlanCheckoutLink } from "@/features/billing/components/plan-checkout-link";
import { getCurrentTenantAccess } from "@/lib/auth/session";

const loginHighlights = [
  {
    description: "Receitas, despesas e faturas em uma visao direta.",
    icon: BarChart3,
    title: "Visao consolidada"
  },
  {
    description: "Metas, vencimentos e alertas no ritmo da sua rotina.",
    icon: BellRing,
    title: "Rotina organizada"
  },
  {
    description: "WhatsApp para registrar, consultar e acelerar tarefas.",
    icon: MessageCircle,
    title: "Canal protagonista"
  }
] as const;

function isNextRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}

export default async function LoginPage() {
  try {
    const access = await getCurrentTenantAccess({
      allowBlocked: true
    });

    if (!access.license.canAccessApp) {
      redirect(`/license?reason=${access.blockedReason ?? "expired"}`);
    }

    redirect("/dashboard");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    // Session is absent or invalid; keep the login page public.
  }

  return (
    <main id="main-content" className="page-shell grid min-h-dvh items-center py-8">
      <section className="mx-auto grid w-full max-w-[1080px] gap-5 xl:grid-cols-[0.95fr_1fr] xl:items-stretch">
        <div className="surface-strong hidden overflow-hidden rounded-[32px] p-7 xl:block">
          <div className="flex h-full flex-col">
            <BrandMark inverted />

            <div className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_36px_rgba(5,45,48,0.22)]">
              <ShieldCheck className="size-4 text-[#9df7e5]" />
              Acesso seguro
            </div>

            <div className="mt-8 max-w-[24rem]">
              <h1 className="text-balance text-[clamp(2rem,3vw,3rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-white">
                Financas claras, rotina no lugar.
              </h1>
              <p className="mt-5 max-w-[22rem] text-sm leading-7 text-white/82">
                Um painel financeiro com leitura rapida, automacoes uteis e contexto suficiente para decidir sem bagunca.
              </p>
            </div>

            <div className="mt-8 grid flex-1 content-end gap-5">
              <div className="flex items-end justify-between gap-5">
                <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-4 text-sm leading-6 text-white/76">
                  <p className="font-semibold text-white">Premium, mas pratico.</p>
                  <p className="mt-1">Feito para o financeiro do dia a dia continuar simples.</p>
                </div>
                <AwuMascot className="w-32" title="Awu dando boas-vindas" variant="default" />
              </div>

              <div className="grid gap-3">
                {loginHighlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      className="grid grid-cols-[2.75rem_1fr] items-center gap-3 rounded-[22px] border border-white/14 bg-white/[0.08] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      key={item.title}
                    >
                      <span className="flex size-11 items-center justify-center rounded-[16px] bg-white/12 text-[#9df7e5]">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">{item.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-white/72">{item.description}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="surface mx-auto w-full max-w-[560px] rounded-[30px] p-6 shadow-[0_28px_80px_rgba(37,29,16,0.12)] md:p-8 xl:my-auto">
          <div className="max-w-[28rem]">
            <BrandMark className="xl:hidden" compact />
            <div className="eyebrow mt-0">Acesso seguro</div>
            <h2 className="section-title mt-7">Entrar no painel</h2>
            <p className="section-copy mt-4">
              Use seu e-mail e senha para continuar. Depois, acompanhe o financeiro pelo painel ou acelere a rotina pelo
              WhatsApp.
            </p>
          </div>
          <LoginForm />
          <div className="mt-6 grid gap-4 rounded-[1.35rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_42%,var(--color-card))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">Ainda escolhendo o plano?</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
                Compare limites, WhatsApp, automacoes e checkout Mercado Pago antes de assinar.
              </p>
            </div>
            <Button asChild className="h-12" variant="secondary">
              <Link href="/planos">Ver planos e assinatura</Link>
            </Button>
          </div>
          <div className="mt-6 rounded-[1.1rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_74%,transparent)] px-4 py-3 text-center">
            <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
              Esqueceu a senha?{" "}
              <a className="font-semibold text-[var(--color-primary)]" href="/forgot-password">
                Recuperar acesso
              </a>
              <span aria-hidden="true" className="mx-2 text-[var(--color-border)]">
                /
              </span>
              <PlanCheckoutLink>Assinar Premium</PlanCheckoutLink>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
