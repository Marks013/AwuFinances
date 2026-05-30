import Link from "next/link";
import type { CSSProperties } from "react";
import { AtSign, Mail, MessageCircle, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";

type BubbleStyle = CSSProperties & Record<`--${string}`, string>;

const footerBubbles = Array.from({ length: 128 }, (_, index) => {
  const size = 1.7 + ((index * 37) % 42) / 10;
  const distance = 5.5 + ((index * 53) % 46) / 10;
  const position = -5 + ((index * 29) % 110);
  const time = 2.3 + ((index * 17) % 24) / 10;
  const delay = -1 * (2 + ((index * 31) % 22) / 10);

  return {
    "--delay": `${delay.toFixed(1)}s`,
    "--distance": `${distance.toFixed(1)}rem`,
    "--position": `${position}%`,
    "--size": `${size.toFixed(1)}rem`,
    "--time": `${time.toFixed(1)}s`
  } as BubbleStyle;
});

const footerNav = [
  { href: "/planos", label: "Planos" },
  { href: "/cadastro", label: "Criar conta" },
  { href: "/login", label: "Entrar" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos-de-uso", label: "Termos" }
] as const;

const contactLinks = [
  {
    href: "https://www.instagram.com/awufinances/",
    icon: AtSign,
    label: "Instagram",
    value: "@awufinances"
  },
  {
    href: "mailto:suporte@awufinances.com.br",
    icon: Mail,
    label: "E-mail",
    value: "suporte@awufinances.com.br"
  },
  {
    href: "/dashboard/whatsapp",
    icon: MessageCircle,
    label: "WhatsApp",
    value: "Assistente financeiro no Premium"
  }
] as const;

export function GooeyFooter() {
  return (
    <footer className="awu-gooey-footer mt-5 text-white md:mt-8">
      <div aria-hidden="true" className="awu-gooey-footer__bubbles">
        {footerBubbles.map((style, index) => (
          <span className="awu-gooey-footer__bubble" key={index} style={style} />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-5 pb-10 pt-16 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <BrandMark className="text-white" compact inverted />
          <p className="mt-5 text-sm leading-7 text-white/70">
            Controle financeiro diario para organizar contas, cartoes, recorrencias e relatorios sem perder o pulso da rotina.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2 text-xs font-bold text-white/78 shadow-[0_16px_38px_rgba(5,45,48,0.24)] backdrop-blur-md">
            <ShieldCheck className="size-4 text-[#95f5df]" />
            Dados isolados por carteira
          </div>
        </div>

        <nav aria-label="Links do rodape" className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/48">Navegacao</p>
          <div className="mt-5 grid gap-3">
            {footerNav.map((item) => (
              <Link
                className="w-fit text-sm font-semibold text-white/72 transition duration-300 hover:translate-x-1 hover:text-white"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/48">Contato</p>
          <div className="mt-5 grid gap-3">
            {contactLinks.map((item) => {
              const Icon = item.icon;
              const isInternal = item.href.startsWith("/");
              const className =
                "group flex min-w-0 items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.07] px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.12]";
              const content = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#95f5df]/14 text-[#95f5df] transition duration-300 group-hover:bg-[#95f5df]/22">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-[0.14em] text-white/46">{item.label}</span>
                    <span className="mt-1 block truncate text-sm font-semibold text-white/78">{item.value}</span>
                  </span>
                </>
              );

              return isInternal ? (
                <Link className={className} href={item.href} key={item.href}>
                  {content}
                </Link>
              ) : (
                <a className={className} href={item.href} key={item.href} rel="noreferrer" target="_blank">
                  {content}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>(c) 2026 Awu Finances. Todos os direitos reservados.</p>
          <p>Organizacao financeira com privacidade, automacao e clareza.</p>
        </div>
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden"
        focusable="false"
      >
        <defs>
          <filter id="awu-footer-blob">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              result="blob"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            />
          </filter>
        </defs>
      </svg>
    </footer>
  );
}
