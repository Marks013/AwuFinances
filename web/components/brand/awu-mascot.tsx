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
    src: "/mascots/awu-default.webp?v=20260512-clean",
    width: 304
  },
  whatsapp: {
    height: 392,
    label: "Awu com celular",
    src: "/mascots/awu-whatsapp.webp?v=20260512-clean",
    width: 306
  },
  report: {
    height: 391,
    label: "Awu com gráfico",
    src: "/mascots/awu-report.webp?v=20260512-clean",
    width: 315
  },
  success: {
    height: 399,
    label: "Awu comemorando",
    src: "/mascots/awu-success.webp?v=20260512-clean",
    width: 318
  },
  alert: {
    height: 407,
    label: "Awu apontando",
    src: "/mascots/awu-alert.webp?v=20260512-clean",
    width: 291
  },
  "empty-state": {
    height: 389,
    label: "Awu esperando uma ação",
    src: "/mascots/awu-empty-state.webp?v=20260512-clean",
    width: 278
  },
  admin: {
    height: 720,
    label: "Awu Clientes",
    src: "/mascots/awu-admin.webp?v=20260512-clean",
    width: 720
  }
};

export function AwuMascot({ className, title, variant = "default" }: AwuMascotProps) {
  const asset = mascotAssets[variant];

  return (
    <Image
      alt={title ?? asset.label}
      className={cn("h-auto w-40 shrink-0 object-contain drop-shadow-[0_24px_34px_rgba(16,27,24,0.18)]", className)}
      decoding="async"
      draggable={false}
      height={asset.height}
      loading="lazy"
      sizes="(max-width: 640px) 7rem, 10rem"
      src={asset.src}
      unoptimized
      width={asset.width}
    />
  );
}
