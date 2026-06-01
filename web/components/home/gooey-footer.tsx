import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, AtSign, Mail, MessageCircle, ShieldCheck } from "lucide-react";

type BubbleStyle = CSSProperties & Record<`--${string}`, string>;

const footerBubbles = Array.from({ length: 128 }, (_, index) => {
  const size = 2 + ((index * 37) % 40) / 10;
  const distance = 6 + ((index * 53) % 40) / 10;
  const position = -5 + ((index * 29) % 110);
  const time = 2 + ((index * 17) % 20) / 10;
  const delay = -1 * (2 + ((index * 31) % 20) / 10);

  return {
    "--delay": `${delay.toFixed(1)}s`,
    "--distance": `${distance.toFixed(1)}rem`,
    "--position": `${position}%`,
    "--size": `${size.toFixed(1)}rem`,
    "--time": `${time.toFixed(1)}s`
  } as BubbleStyle;
});

const footerGroups = [
  {
    title: "Awu",
    links: [
      { href: "/planos", label: "Planos" },
      { href: "/cadastro", label: "Criar conta" },
      { href: "/login", label: "Entrar" }
    ]
  },
  {
    title: "Recursos",
    links: [
      { href: "/dashboard/reports", label: "Relatorios" },
      { href: "/dashboard/transactions", label: "Transacoes" },
      { href: "/dashboard/whatsapp", label: "WhatsApp" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/privacidade", label: "Privacidade" },
      { href: "/termos-de-uso", label: "Termos" }
    ]
  }
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
    <footer className="awu-gooey-footer text-white">
      <div aria-hidden="true" className="awu-gooey-footer__bubbles">
        {footerBubbles.map((style, index) => (
          <span className="awu-gooey-footer__bubble" key={index} style={style} />
        ))}
      </div>

      <div className="awu-gooey-footer__content">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-10 pt-16 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1.1fr_1fr] lg:px-8">
          <div className="max-w-sm">
            <Link aria-label="Awu Finances" className="inline-flex items-center gap-3" href="/">
              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-visible rounded-[1.35rem] border border-white/18 bg-white/12 shadow-[0_18px_38px_rgba(5,45,48,0.24)] backdrop-blur-md">
                <Image
                  alt=""
                  className="h-16 w-16 max-w-none object-contain drop-shadow-[0_10px_18px_rgba(3,35,39,0.22)]"
                  height={96}
                  priority={false}
                  src="/brand/awu-logo-mascot.webp"
                  width={96}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9rem] font-semibold tracking-[-0.035em] text-white">Awu Finances</span>
                <span className="mt-0.5 block text-[0.63rem] font-medium uppercase leading-5 tracking-[0.12em] text-white/70">
                  Controle operacional
                </span>
              </span>
            </Link>
            <p className="mt-5 text-sm leading-7 text-white/86">
              Controle financeiro diario para organizar contas, cartoes, recorrencias, relatorios e rotina pelo WhatsApp.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/14 px-4 py-2 text-xs font-bold text-white/92 shadow-[0_16px_38px_rgba(5,45,48,0.24)] backdrop-blur-md">
              <ShieldCheck className="size-4 text-[#9df7e5]" />
              Dados isolados por carteira
            </div>
          </div>

          <nav aria-label="Links do rodape" className="grid min-w-0 gap-6 sm:grid-cols-3 lg:gap-8">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/68">{group.title}</p>
                <div className="mt-5 grid gap-3">
                  {group.links.map((item) => (
                    <Link
                      className="group/link inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-white/86 transition duration-300 hover:translate-x-1 hover:text-white"
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                      <ArrowUpRight className="size-3 opacity-0 transition duration-300 group-hover/link:opacity-100" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/68">Contato</p>
            <div className="mt-5 grid gap-3">
              {contactLinks.map((item) => {
                const Icon = item.icon;
                const isInternal = item.href.startsWith("/");
                const className =
                  "group flex min-w-0 items-center gap-3 rounded-[18px] border border-white/16 bg-white/[0.12] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.18]";
                const content = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#9df7e5]/16 text-[#9df7e5] transition duration-300 group-hover:bg-[#9df7e5]/24">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase tracking-[0.14em] text-white/68">{item.label}</span>
                      <span className="mt-1 block truncate text-sm font-semibold text-white/92">{item.value}</span>
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
      </div>

      <div className="awu-gooey-footer__bottom border-t border-white/10 py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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
