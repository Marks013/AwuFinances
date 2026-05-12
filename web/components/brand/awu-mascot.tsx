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
    height: 419,
    label: "Awu acenando",
    src: "/mascots/awu-default.webp",
    width: 330
  },
  whatsapp: {
    height: 400,
    label: "Awu com celular",
    src: "/mascots/awu-whatsapp.webp",
    width: 334
  },
  report: {
    height: 399,
    label: "Awu com gráfico",
    src: "/mascots/awu-report.webp",
    width: 340
  },
  success: {
    height: 407,
    label: "Awu comemorando",
    src: "/mascots/awu-success.webp",
    width: 350
  },
  alert: {
    height: 415,
    label: "Awu apontando",
    src: "/mascots/awu-alert.webp",
    width: 355
  },
  "empty-state": {
    height: 397,
    label: "Awu esperando uma ação",
    src: "/mascots/awu-empty-state.webp",
    width: 345
  },
  admin: {
    height: 720,
    label: "Awu Clientes",
    src: "/mascots/awu-admin.webp",
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
      width={asset.width}
    />
  );
}
