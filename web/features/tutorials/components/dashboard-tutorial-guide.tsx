"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, MapPinned, RotateCcw, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { dashboardTutorialSteps, type TutorialRequirement, type TutorialStep } from "@/features/tutorials/tutorial-catalog";
import { ensureApiResponse } from "@/lib/observability/http";
import { cn } from "@/lib/utils";

type TutorialContext = {
  isPlatformAdmin: boolean;
  counts: {
    accounts: number;
    standardAccounts: number;
    benefitFoodAccounts: number;
    cards: number;
    expenseCategories: number;
    incomeCategories: number;
    subscriptions: number;
    transactions: number;
    installmentGroups: number;
  };
  permissions: {
    canManageSharing: boolean;
    canAccessSharingPage: boolean;
    canEditAutoTithe: boolean;
    canEditWhatsAppNumber: boolean;
  };
  license: {
    planLabel: string;
    statusLabel: string;
    features: {
      whatsappAssistant: boolean;
    };
  };
  integrations: {
    whatsappAssistantEnabled: boolean;
    whatsappConfigured: boolean;
    whatsappIssue: string | null;
  };
  profile: {
    whatsappNumberConfigured: boolean;
    autoTithe: boolean;
  };
};

type TutorialStatePayload = {
  progress: {
    status: "not_started" | "active" | "completed" | "skipped";
    currentStepKey: string | null;
    completedStepKeys: string[];
  };
  context: TutorialContext;
};

type RequirementNotice = {
  title: string;
  message: string;
  actionLabel: string;
  route: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

async function getTutorialState() {
  const response = await fetch("/api/tutorials/state", { cache: "no-store" });
  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao carregar tutorial",
    method: "GET",
    path: "/api/tutorials/state"
  });

  return (await response.json()) as TutorialStatePayload;
}

async function updateTutorialProgress(input: {
  status: "active" | "completed" | "skipped";
  currentStepKey: string | null;
  completedStepKeys: string[];
}) {
  const response = await fetch("/api/tutorials/state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao salvar tutorial",
    method: "PATCH",
    path: "/api/tutorials/state"
  });

  return response.json();
}

function routeWithMonth(route: string, month: string | null) {
  if (!month || !route.startsWith("/dashboard")) return route;

  const [pathname, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("month")) params.set("month", month);
  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function firstRequirementNotice(requirement: TutorialRequirement, context: TutorialContext): RequirementNotice | null {
  if (requirement === "account" && context.counts.accounts < 1) {
    return {
      title: "Antes disso, cadastre uma conta",
      message: "Pix, dinheiro, debito, receitas e transferencias precisam de uma conta ativa para nao ficarem sem origem.",
      actionLabel: "Criar conta",
      route: "/dashboard/accounts"
    };
  }

  if (requirement === "card" && context.counts.cards < 1) {
    return {
      title: "Parcelamento precisa de cartao",
      message: "Cadastre um cartao com dia de fechamento e vencimento antes de lancar compras parceladas.",
      actionLabel: "Criar cartao",
      route: "/dashboard/accounts?view=cards"
    };
  }

  if (requirement === "whatsapp-feature" && !context.license.features.whatsappAssistant) {
    return {
      title: "WhatsApp nao esta liberado no plano atual",
      message: `O plano ${context.license.planLabel} nao permite o assistente financeiro por WhatsApp nesta conta.`,
      actionLabel: "Ver ajustes",
      route: "/dashboard/settings"
    };
  }

  if (requirement === "whatsapp-number" && !context.profile.whatsappNumberConfigured) {
    return {
      title: "Informe seu numero antes de usar o assistente",
      message: "O sistema so deve responder numeros cadastrados para reduzir risco, confusao e mensagens fora da conta.",
      actionLabel: "Configurar WhatsApp",
      route: "/dashboard/settings"
    };
  }

  if (requirement === "sharing-permission" && !context.permissions.canAccessSharingPage) {
    return {
      title: "Compartilhamento fica com o titular",
      message: "Esta conta nao tem permissao para gerenciar convites familiares. O titular ou admin da conta controla esse modulo.",
      actionLabel: "Abrir ajustes",
      route: "/dashboard/settings"
    };
  }

  return null;
}

function resolveNotice(step: TutorialStep, context: TutorialContext | null) {
  if (!context) return null;

  for (const requirement of step.requirements ?? []) {
    const notice = firstRequirementNotice(requirement, context);
    if (notice) return notice;
  }

  return null;
}

function resolveStepDone(step: TutorialStep, context: TutorialContext | null) {
  if (!context) return false;

  if (step.key === "first-account") return context.counts.accounts > 0;
  if (step.key === "card-installments") return context.counts.cards > 0;
  if (step.key === "whatsapp-and-tithe") {
    return (
      context.license.features.whatsappAssistant &&
      context.profile.whatsappNumberConfigured &&
      context.integrations.whatsappAssistantEnabled &&
      context.integrations.whatsappConfigured
    );
  }
  if (step.key === "sharing") return context.permissions.canAccessSharingPage;

  return false;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function DashboardTutorialGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const month = searchParams.get("month");
  const enabled = pathname.startsWith("/dashboard") && !pathname.startsWith("/dashboard/admin");
  const [open, setOpen] = useState(false);
  const [currentStepKey, setCurrentStepKey] = useState(dashboardTutorialSteps[0]?.key ?? "");
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const autoOpenedRef = useRef(false);

  const stateQuery = useQuery({
    queryKey: ["tutorial-state"],
    queryFn: getTutorialState,
    enabled,
    refetchInterval: open ? 10_000 : false,
    staleTime: 15_000
  });

  const progressMutation = useMutation({
    mutationFn: updateTutorialProgress,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tutorial-state"] });
    }
  });

  const context = stateQuery.data?.context ?? null;
  const progress = stateQuery.data?.progress ?? null;
  const completedStepKeys = useMemo(() => new Set(progress?.completedStepKeys ?? []), [progress?.completedStepKeys]);
  const currentIndex = Math.max(
    0,
    dashboardTutorialSteps.findIndex((step) => step.key === currentStepKey)
  );
  const currentStep = dashboardTutorialSteps[currentIndex] ?? dashboardTutorialSteps[0];
  const notice = currentStep ? resolveNotice(currentStep, context) : null;
  const isDoneByState = currentStep ? resolveStepDone(currentStep, context) : false;
  const status = progress?.status ?? "not_started";
  const inactive = !open || !currentStep || !enabled || context?.isPlatformAdmin;

  useEffect(() => {
    if (!enabled || !stateQuery.data || context?.isPlatformAdmin || autoOpenedRef.current) return;

    const nextStepKey = stateQuery.data.progress.currentStepKey ?? dashboardTutorialSteps[0]?.key ?? "";

    if (stateQuery.data.progress.status === "active" || stateQuery.data.progress.status === "not_started") {
      autoOpenedRef.current = true;
      const timeout = window.setTimeout(() => {
        setCurrentStepKey(nextStepKey);
        setOpen(true);
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [context?.isPlatformAdmin, enabled, stateQuery.data]);

  useEffect(() => {
    if (!open || !currentStep) {
      return;
    }

    let frame = 0;
    const updateTarget = () => {
      const target = document.querySelector(currentStep.targetSelector);

      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: Math.max(8, rect.top - 8),
        left: Math.max(8, rect.left - 8),
        width: Math.min(window.innerWidth - 16, rect.width + 16),
        height: Math.min(window.innerHeight - 16, rect.height + 16)
      });
    };

    const scrollToTarget = () => {
      const target = document.querySelector(currentStep.targetSelector);
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      updateTarget();
    };

    frame = window.setTimeout(scrollToTarget, 180);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);

    return () => {
      window.clearTimeout(frame);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [currentStep, open, pathname, searchParams]);

  const persist = (
    statusValue: "active" | "completed" | "skipped",
    stepKey: string | null,
    nextCompletedStepKeys: string[]
  ) => {
    progressMutation.mutate({
      status: statusValue,
      currentStepKey: stepKey,
      completedStepKeys: nextCompletedStepKeys
    });
  };

  const openRoute = (route: string) => {
    router.push(routeWithMonth(route, month) as Route);
  };

  const startTutorial = () => {
    const firstStep = dashboardTutorialSteps[0];
    if (!firstStep) return;

    setCurrentStepKey(firstStep.key);
    setOpen(true);
    persist("active", firstStep.key, []);
    openRoute(firstStep.route);
  };

  const goToIndex = (index: number) => {
    const nextStep = dashboardTutorialSteps[index];
    if (!nextStep || !currentStep) return;

    const nextCompleted = Array.from(new Set([...completedStepKeys, currentStep.key]));
    setCurrentStepKey(nextStep.key);
    persist("active", nextStep.key, nextCompleted);
    openRoute(nextStep.route);
  };

  const completeTutorial = () => {
    const nextCompleted = currentStep ? Array.from(new Set([...completedStepKeys, currentStep.key])) : Array.from(completedStepKeys);
    setOpen(false);
    persist("completed", currentStep?.key ?? null, nextCompleted);
  };

  const skipTutorial = () => {
    setOpen(false);
    persist("skipped", currentStep?.key ?? null, Array.from(completedStepKeys));
  };

  if (!enabled || context?.isPlatformAdmin) {
    return null;
  }

  if (inactive) {
    return (
      <button
        aria-label={status === "completed" || status === "skipped" ? "Refazer tutorial guiado" : "Abrir tutorial guiado"}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_92%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--color-foreground)] shadow-md backdrop-blur-md transition hover:border-[color-mix(in_srgb,var(--color-primary)_36%,var(--color-border))] hover:bg-[var(--color-card)]"
        type="button"
        onClick={startTutorial}
      >
        <BookOpenCheck className="size-4 text-[var(--color-primary)]" />
        {status === "completed" || status === "skipped" ? "Refazer tutorial" : "Tutorial"}
      </button>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / dashboardTutorialSteps.length) * 100);
  const routeTarget = notice?.route ?? currentStep.route;
  const isLastStep = currentIndex >= dashboardTutorialSteps.length - 1;
  const visibleTargetRect = open ? targetRect : null;

  return (
    <>
      {visibleTargetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-30 rounded-[1.4rem] border-2 border-[var(--color-primary)] shadow-[0_0_0_9999px_color-mix(in_srgb,var(--color-background)_58%,transparent)]"
          style={{
            top: visibleTargetRect.top,
            left: visibleTargetRect.left,
            width: visibleTargetRect.width,
            height: visibleTargetRect.height
          }}
        />
      ) : null}

      <section
        aria-label="Tutorial guiado"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-[1.35rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_96%,transparent)] p-4 text-[var(--color-foreground)] shadow-xl backdrop-blur-md sm:bottom-5 sm:right-5 sm:left-auto sm:mx-0 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1">
                <MapPinned className="size-3.5 text-[var(--color-primary)]" />
                Passo {currentIndex + 1} de {dashboardTutorialSteps.length}
              </span>
              {isDoneByState ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--color-primary)_32%,var(--color-border))] px-2.5 py-1 text-[var(--color-primary)]">
                  <CheckCircle2 className="size-3.5" />
                  {currentStep.successLabel ?? "Pronto"}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-balance text-lg font-semibold leading-snug">{currentStep.title}</h2>
          </div>
          <button
            aria-label="Fechar tutorial por enquanto"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
            type="button"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-muted)_70%,transparent)]">
          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${progressPercent}%` }} />
        </div>

        <p className="mt-4 text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">{currentStep.description}</p>

        {currentStep.supportText ? (
          <p className="mt-3 rounded-[1rem] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-muted)_36%,transparent)] px-3 py-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {currentStep.supportText}
          </p>
        ) : null}

        {notice ? (
          <div className="mt-3 rounded-[1rem] border border-amber-500/35 bg-amber-500/10 p-3 text-sm leading-6">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              {notice.title}
            </p>
            <p className="mt-1 text-[var(--color-muted-foreground)]">{notice.message}</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <Button className="min-h-10 px-3 py-2 text-xs" type="button" variant="ghost" onClick={skipTutorial}>
            Pular tutorial
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="min-h-10 px-3 py-2 text-xs"
              disabled={currentIndex === 0 || progressMutation.isPending}
              type="button"
              variant="secondary"
              onClick={() => goToIndex(currentIndex - 1)}
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
            <Button
              className="min-h-10 px-3 py-2 text-xs"
              disabled={progressMutation.isPending}
              type="button"
              variant="secondary"
              onClick={() => openRoute(routeTarget)}
            >
              {notice ? notice.actionLabel : currentStep.primaryLabel}
            </Button>
          </div>

          <Button
            className={cn("min-h-10 px-3 py-2 text-xs", isLastStep && "sm:min-w-28")}
            disabled={progressMutation.isPending}
            type="button"
            onClick={isLastStep ? completeTutorial : () => goToIndex(currentIndex + 1)}
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="size-4" />
                Concluir
              </>
            ) : (
              <>
                Avancar
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        {status === "completed" || status === "skipped" ? (
          <button
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
            type="button"
            onClick={startTutorial}
          >
            <RotateCcw className="size-3.5" />
            Reiniciar do primeiro passo
          </button>
        ) : null}
      </section>
    </>
  );
}
