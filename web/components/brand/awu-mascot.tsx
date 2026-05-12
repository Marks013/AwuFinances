import Image from "next/image";

import { cn } from "@/lib/utils";

export type AwuMascotVariant = "default" | "whatsapp" | "report" | "success" | "alert" | "empty-state" | "admin";

type AwuMascotProps = {
  className?: string;
  title?: string;
  variant?: AwuMascotVariant;
};

const mascotAssets: Record<AwuMascotVariant, { height: number; label: string; src: string; width: number }> = {
  default: {
    height: 411,
    label: "Awu acenando",
    src: "/mascots/awu-default.webp?v=20260512-transparent",
    width: 304
  },
  whatsapp: {
    height: 392,
    label: "Awu com celular",
    src: "/mascots/awu-whatsapp.webp?v=20260512-transparent",
    width: 306
  },
  report: {
    height: 391,
    label: "Awu com gráfico",
    src: "/mascots/awu-report.webp?v=20260512-transparent",
    width: 315
  },
  success: {
    height: 399,
    label: "Awu comemorando",
    src: "/mascots/awu-success.webp?v=20260512-transparent",
    width: 318
  },
  alert: {
    height: 407,
    label: "Awu apontando",
    src: "/mascots/awu-alert.webp?v=20260512-transparent",
    width: 291
  },
  "empty-state": {
    height: 389,
    label: "Awu esperando uma ação",
    src: "/mascots/awu-empty-state.webp?v=20260512-transparent",
    width: 278
  },
  admin: {
    height: 720,
    label: "Awu Clientes",
    src: "/mascots/awu-admin.webp?v=20260512-transparent",
    width: 720
  }
};

export function AwuMascot({ className, title, variant = "default" }: AwuMascotProps) {
  const asset = mascotAssets[variant];

  return (
    <span
      aria-label={title ?? asset.label}
      className={cn("awu-mascot relative inline-flex h-auto w-40 shrink-0", className)}
      data-variant={variant}
      role="img"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="awu-mascot-image h-auto w-full object-contain drop-shadow-[0_24px_34px_rgba(16,27,24,0.18)]"
        decoding="async"
        draggable={false}
        height={asset.height}
        loading="lazy"
        sizes="(max-width: 640px) 7rem, 10rem"
        src={asset.src}
        unoptimized
        width={asset.width}
      />
      <span aria-hidden="true" className="awu-mascot-glow" />
      <span aria-hidden="true" className="awu-mascot-blink awu-mascot-blink-left" />
      <span aria-hidden="true" className="awu-mascot-blink awu-mascot-blink-right" />
      <span aria-hidden="true" className="awu-mascot-motion-line awu-mascot-motion-line-one" />
      <span aria-hidden="true" className="awu-mascot-motion-line awu-mascot-motion-line-two" />
      <span aria-hidden="true" className="awu-mascot-sparkle awu-mascot-sparkle-one" />
      <span aria-hidden="true" className="awu-mascot-sparkle awu-mascot-sparkle-two" />
      <span aria-hidden="true" className="awu-mascot-cue" />
    </span>
  );
}
