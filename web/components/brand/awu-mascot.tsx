import { cn } from "@/lib/utils";

export type AwuMascotVariant = "default" | "whatsapp" | "report" | "success" | "alert" | "empty-state" | "admin";

type AwuMascotProps = {
  className?: string;
  title?: string;
  variant?: AwuMascotVariant;
};

const variantTilt: Record<AwuMascotVariant, string> = {
  default: "-rotate-2",
  whatsapp: "rotate-1",
  report: "-rotate-1",
  success: "rotate-2",
  alert: "-rotate-1",
  "empty-state": "rotate-0",
  admin: "rotate-1"
};

export function AwuMascot({ className, title, variant = "default" }: AwuMascotProps) {
  const isEmpty = variant === "empty-state";
  const isAlert = variant === "alert";
  const isSuccess = variant === "success";
  const isAdmin = variant === "admin";
  const isReport = variant === "report";
  const isWhatsapp = variant === "whatsapp";

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={cn("h-auto w-40 shrink-0 drop-shadow-[0_24px_34px_rgba(16,27,24,0.18)]", variantTilt[variant], className)}
      role={title ? "img" : undefined}
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="awu-mascot-body" x1="80" x2="238" y1="42" y2="248" gradientUnits="userSpaceOnUse">
          <stop stopColor="#91f0b7" />
          <stop offset="0.58" stopColor="#56d98a" />
          <stop offset="1" stopColor="#28ad6c" />
        </linearGradient>
        <linearGradient id="awu-mascot-ink" x1="72" x2="248" y1="58" y2="266" gradientUnits="userSpaceOnUse">
          <stop stopColor="#143456" />
          <stop offset="1" stopColor="#071827" />
        </linearGradient>
        <radialGradient id="awu-mascot-eye" cx="0" cy="0" r="1" gradientTransform="matrix(22 26 -22 19 0 0)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8ffff" />
          <stop offset="0.46" stopColor="#0f9f8d" />
          <stop offset="1" stopColor="#071827" />
        </radialGradient>
      </defs>

      {isAdmin ? (
        <g opacity="0.9">
          <circle cx="242" cy="102" r="28" fill="#dff9e8" />
          <circle cx="242" cy="94" r="12" fill="#143456" />
          <path d="M216 126c9-18 44-18 52 0v12h-52z" fill="#143456" />
          <circle cx="210" cy="112" r="10" fill="#76daa0" />
          <path d="M192 139c3-15 28-15 34 0z" fill="#76daa0" />
          <circle cx="274" cy="112" r="10" fill="#76daa0" />
          <path d="M258 139c6-15 31-15 34 0z" fill="#76daa0" />
        </g>
      ) : null}

      <ellipse cx="160" cy="266" rx={isEmpty ? 76 : 67} ry="18" fill="#071827" opacity="0.12" />
      <path d="M88 145c-42 24-51 76-35 102 33-7 58-33 70-67z" fill="url(#awu-mascot-ink)" opacity="0.96" />
      <path d="M232 145c42 24 51 76 35 102-33-7-58-33-70-67z" fill="url(#awu-mascot-ink)" opacity="0.96" />

      {isEmpty ? (
        <>
          <path d="M110 245c-6 25-33 25-48 10 14-6 23-17 27-32z" fill="url(#awu-mascot-ink)" />
          <path d="M210 245c6 25 33 25 48 10-14-6-23-17-27-32z" fill="url(#awu-mascot-ink)" />
        </>
      ) : null}

      <path
        d="M76 139c0-58 32-105 84-105s84 47 84 105v44c0 57-34 87-84 87s-84-30-84-87z"
        fill="url(#awu-mascot-body)"
      />
      <path d="M90 111c14-33 37-51 70-51s56 18 70 51l-70 33z" fill="#ecf9e9" />
      <path d="M112 95c20-27 71-27 96 0l-48 48z" fill="#ecf9e9" />
      <path d="M127 48c6-23 32-34 45-24 6 17-11 37-45 24z" fill="url(#awu-mascot-ink)" />
      <path d="M166 46c12-18 36-22 45-9 1 18-20 30-45 9z" fill="url(#awu-mascot-ink)" />
      <path d="M85 157c28 18 122 18 150 0" fill="none" stroke="#102843" strokeLinecap="round" strokeWidth="17" />

      <circle cx="127" cy="128" r="20" fill="white" />
      <circle cx="193" cy="128" r="20" fill="white" />
      <circle cx="128" cy="130" r="14" fill="url(#awu-mascot-eye)" />
      <circle cx="194" cy="130" r="14" fill="url(#awu-mascot-eye)" />
      <circle cx="134" cy="122" r="4" fill="white" />
      <circle cx="200" cy="122" r="4" fill="white" />
      <path d="M114 104c6-6 14-6 20 0" fill="none" stroke="#102843" strokeLinecap="round" strokeWidth="5" />
      <path d="M186 104c6-6 14-6 20 0" fill="none" stroke="#102843" strokeLinecap="round" strokeWidth="5" />
      <path
        d={isAlert || isEmpty ? "M148 157c7-5 17-5 24 0" : "M145 153c7 20 23 20 30 0"}
        fill={isAlert || isEmpty ? "none" : "#102843"}
        stroke="#102843"
        strokeLinecap="round"
        strokeWidth={isAlert || isEmpty ? 5 : 0}
      />
      {!isAlert && !isEmpty ? <path d="M153 164c4 5 12 5 16 0" fill="none" stroke="#ff7b76" strokeLinecap="round" strokeWidth="7" /> : null}

      <rect x="117" y="198" width="86" height="48" rx="18" fill="url(#awu-mascot-ink)" />
      <path d="M136 226l20-21 17 14 25-29" fill="none" stroke="#8cf4a6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" />
      <path d="M190 190h10v10" fill="none" stroke="#8cf4a6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" />
      <circle cx="207" cy="164" r="18" fill="#5bd889" stroke="#a8f5be" strokeWidth="4" />
      <path d="M201 164h12M207 158v12" stroke="#fff8ec" strokeLinecap="round" strokeWidth="4" />

      {variant === "default" ? (
        <>
          <path d="M85 151c-32-19-47-37-52-61" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="20" />
          <path d="M30 86c-8 10-8 25 2 35" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="8" />
          <path d="M51 151c-7 10-9 22-6 34" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="18" />
        </>
      ) : null}

      {isWhatsapp ? (
        <>
          <path d="M226 170c28-7 47-1 57 15" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <rect x="242" y="126" width="42" height="72" rx="10" fill="#102843" stroke="#6de2a0" strokeWidth="4" />
          <path d="M256 162c8-10 24-5 24 8 0 13-16 18-24 8l-8 3 3-9c-1-3-1-7 5-10z" fill="#8cf4a6" />
        </>
      ) : null}

      {isReport ? (
        <>
          <path d="M88 169c-26-5-40 8-46 27" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <rect x="28" y="152" width="58" height="76" rx="9" fill="#fff8ec" stroke="#102843" strokeWidth="7" />
          <path d="M43 207v-20M57 207v-34M71 207v-49" stroke="#102843" strokeLinecap="round" strokeWidth="7" />
          <path d="M42 170l15-12 9 8 13-17" fill="none" stroke="#5bd889" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
        </>
      ) : null}

      {isSuccess ? (
        <>
          <path d="M224 169c24-13 48-12 62 3" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <circle cx="274" cy="126" r="21" fill="#f2c95c" stroke="#d8a72d" strokeWidth="5" />
          <path d="M267 126h14M274 119v14" stroke="#fff8ec" strokeLinecap="round" strokeWidth="5" />
          <path d="M68 190c-3 22 15 38 34 31" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <path d="M56 78l7 13 13 7-13 7-7 13-7-13-13-7 13-7z" fill="#fff8ec" opacity="0.9" />
        </>
      ) : null}

      {isAlert ? (
        <>
          <path d="M91 163c-27 1-43 15-49 36" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <path d="M45 145h60l-30 58z" fill="#ffe7a3" stroke="#102843" strokeLinejoin="round" strokeWidth="7" />
          <path d="M75 162v19" stroke="#102843" strokeLinecap="round" strokeWidth="7" />
          <circle cx="75" cy="192" r="4" fill="#102843" />
          <path d="M225 166c24-10 41-7 52 8" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
        </>
      ) : null}

      {isEmpty ? (
        <>
          <path d="M92 172c-22 11-29 30-19 49" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <path d="M228 172c22 11 29 30 19 49" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
        </>
      ) : null}

      {isAdmin ? (
        <>
          <path d="M91 164c-24-4-42 8-51 28" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
          <path d="M226 166c26 10 44 7 60-8" fill="none" stroke="#63df95" strokeLinecap="round" strokeWidth="19" />
        </>
      ) : null}

      <ellipse cx="126" cy="266" rx="17" ry="9" fill="url(#awu-mascot-ink)" />
      <ellipse cx="194" cy="266" rx="17" ry="9" fill="url(#awu-mascot-ink)" />
    </svg>
  );
}
