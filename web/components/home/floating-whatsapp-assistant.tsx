"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useState } from "react";

const whatsappHref =
  "https://wa.me/?text=Ola%2C%20quero%20conhecer%20o%20Awu%20Finances%20e%20entender%20o%20assistente%20financeiro.";

const questions = [
  {
    question: "Como o Awu ajuda no dia a dia?",
    answer: "Ele organiza contas, cartoes, metas e relatorios em um painel simples para acompanhar a rotina financeira."
  },
  {
    question: "O WhatsApp financeiro funciona como?",
    answer: "No Premium, voce pode iniciar a conversa pelo WhatsApp para registrar gastos e consultar informacoes financeiras."
  },
  {
    question: "Tem plano gratuito?",
    answer: "Sim. O plano gratuito libera o essencial para comecar e o Premium amplia limites, WhatsApp e automacoes."
  },
  {
    question: "Meus dados ficam protegidos?",
    answer: "Sim. O sistema usa contas separadas, controle de acesso e historico para rotinas sensiveis."
  }
];

function WhatsAppGlyph() {
  return (
    <svg aria-hidden="true" className="size-7" fill="currentColor" viewBox="0 0 32 32">
      <path d="M16.04 4C9.42 4 4.04 9.31 4.04 15.84c0 2.08.55 4.11 1.59 5.9L4 28l6.42-1.56a12.1 12.1 0 0 0 5.62 1.39c6.62 0 12-5.31 12-11.84S22.66 4 16.04 4Zm0 21.73c-1.75 0-3.47-.46-4.96-1.34l-.36-.21-3.81.93.98-3.61-.24-.38a9.71 9.71 0 0 1-1.5-5.28c0-5.37 4.43-9.74 9.89-9.74s9.89 4.37 9.89 9.74-4.43 9.89-9.89 9.89Zm5.43-7.3c-.3-.15-1.76-.86-2.03-.95-.27-.1-.47-.15-.67.15-.2.29-.77.95-.94 1.15-.17.2-.35.22-.64.07-.3-.15-1.25-.45-2.38-1.45-.88-.77-1.47-1.73-1.64-2.02-.17-.29-.02-.45.13-.6.13-.13.3-.34.45-.51.15-.17.2-.29.3-.49.1-.19.05-.37-.03-.52-.07-.15-.67-1.59-.92-2.18-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.29-1.04 1-1.04 2.44s1.07 2.84 1.22 3.03c.15.2 2.11 3.18 5.12 4.46.72.31 1.28.49 1.72.63.72.23 1.37.2 1.89.12.58-.09 1.76-.71 2-1.39.25-.68.25-1.27.17-1.39-.07-.13-.27-.2-.57-.34Z" />
    </svg>
  );
}

export function FloatingWhatsAppAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const current = questions[activeQuestion];

  return (
    <div className="fixed bottom-5 right-5 z-[95] flex flex-col items-end gap-3">
      {isOpen ? (
        <section
          aria-label="Ajuda rapida Awu"
          className="w-[min(calc(100vw-2rem),22rem)] rounded-[22px] border border-[#25d366]/35 bg-[#fffdf6] p-4 text-[#17231e] shadow-[0_22px_54px_rgba(13,64,46,0.22)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#136f4f]">Awu ajuda</p>
              <h2 className="mt-1 text-base font-semibold leading-tight">Perguntas rapidas</h2>
            </div>
            <button
              aria-label="Fechar ajuda"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d6c7ac] bg-white text-[#17231e] transition hover:-translate-y-0.5"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {questions.map((item, index) => (
              <button
                key={item.question}
                className={
                  index === activeQuestion
                    ? "rounded-[14px] border border-[#136f4f] bg-[#136f4f] px-3 py-2 text-left text-sm font-semibold text-white"
                    : "rounded-[14px] border border-[#d8e3d4] bg-white px-3 py-2 text-left text-sm font-semibold text-[#25342d] transition hover:border-[#25d366]"
                }
                onClick={() => setActiveQuestion(index)}
                type="button"
              >
                {item.question}
              </button>
            ))}
          </div>

          <p className="mt-4 rounded-[16px] bg-[#edf7ee] p-3 text-sm leading-6 text-[#24362f]">{current.answer}</p>
          <a
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-transparent bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(37,211,102,0.26)] transition hover:-translate-y-0.5 hover:bg-[#1fbd59]"
            href={whatsappHref}
            rel="noreferrer"
            target="_blank"
          >
            Falar pelo WhatsApp
            <WhatsAppGlyph />
          </a>
        </section>
      ) : null}

      <button
        aria-expanded={isOpen}
        aria-label="Abrir ajuda do Awu"
        className="inline-flex size-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#25d366] bg-white shadow-[0_16px_34px_rgba(13,64,46,0.24)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/35"
        onClick={() => setIsOpen((value) => !value)}
        title="Ajuda do Awu"
        type="button"
      >
        <Image
          alt="Mascote Awu"
          className="h-full w-full object-contain p-1"
          height={256}
          priority={false}
          src="/brand/awu-chatbox-mascot.webp"
          width={256}
        />
      </button>

      <a
        aria-label="Abrir WhatsApp"
        className="home-floating-whatsapp inline-flex size-14 items-center justify-center rounded-full border border-white/35 bg-[#25d366] text-white shadow-[0_18px_38px_rgba(9,79,42,0.26)] transition hover:-translate-y-0.5 hover:bg-[#1fbd59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/35"
        href={whatsappHref}
        rel="noreferrer"
        target="_blank"
        title="Abrir WhatsApp"
      >
        <WhatsAppGlyph />
      </a>
    </div>
  );
}
