"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AccessCouponTarget = "trial" | "subscription";

type AccessCouponDraft = {
  id?: string;
  code: string;
  title: string;
  description: string;
  target: AccessCouponTarget;
  days: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxRedemptionsPerTenant: number;
  maxRedemptionsPerUser: number;
  _count?: {
    redemptions: number;
  };
};

type AccessCouponResponse = {
  coupon?: AccessCouponDraft;
  coupons?: AccessCouponDraft[];
  message?: string;
};

const emptyCouponDraft: AccessCouponDraft = {
  code: "",
  title: "",
  description: "",
  target: "trial",
  days: 7,
  enabled: true,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  maxRedemptionsPerTenant: 1,
  maxRedemptionsPerUser: 1
};

async function ensureCouponResponse(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => ({}))) as AccessCouponResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? fallbackMessage);
  }

  return payload;
}

async function getAccessCoupons() {
  const response = await fetch("/api/admin/access-coupons", { cache: "no-store" });
  const payload = await ensureCouponResponse(response, "Falha ao carregar cupons de acesso");
  return payload.coupons ?? [];
}

async function createAccessCoupon(coupon: AccessCouponDraft) {
  const response = await fetch("/api/admin/access-coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeCoupon(coupon))
  });

  return ensureCouponResponse(response, "Falha ao criar cupom de acesso");
}

async function updateAccessCoupon(coupon: AccessCouponDraft) {
  if (!coupon.id) {
    throw new Error("Cupom sem identificador");
  }

  const response = await fetch(`/api/admin/access-coupons/${coupon.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeCoupon(coupon))
  });

  return ensureCouponResponse(response, "Falha ao atualizar cupom de acesso");
}

async function deleteAccessCoupon(couponId: string) {
  const response = await fetch(`/api/admin/access-coupons/${couponId}`, {
    method: "DELETE"
  });

  return ensureCouponResponse(response, "Falha ao remover cupom de acesso");
}

function serializeCoupon(coupon: AccessCouponDraft) {
  return {
    code: coupon.code.trim().toUpperCase(),
    title: coupon.title.trim(),
    description: coupon.description.trim() || null,
    target: coupon.target,
    days: Number(coupon.days),
    enabled: Boolean(coupon.enabled),
    startsAt: coupon.startsAt || null,
    endsAt: coupon.endsAt || null,
    maxRedemptions: coupon.maxRedemptions === null ? null : Number(coupon.maxRedemptions),
    maxRedemptionsPerTenant: Number(coupon.maxRedemptionsPerTenant || 1),
    maxRedemptionsPerUser: Number(coupon.maxRedemptionsPerUser || 1)
  };
}

function formatDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

function targetLabel(target: AccessCouponTarget) {
  return target === "trial" ? "Avaliacao" : "Assinatura";
}

function CouponEditor({
  coupon,
  onChange,
  onDelete,
  onSave,
  isSaving,
  isDeleting
}: {
  coupon: AccessCouponDraft;
  onChange: (coupon: AccessCouponDraft) => void;
  onDelete?: () => void;
  onSave: () => void;
  isSaving: boolean;
  isDeleting?: boolean;
}) {
  const redemptionCount = coupon._count?.redemptions ?? 0;

  return (
    <article className="data-card min-w-0 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="break-words text-pretty text-sm font-semibold">{coupon.title || "Novo cupom de acesso"}</p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {coupon.id
              ? `${redemptionCount} resgate(s) registrados`
              : "Ainda nao salvo"}{" "}
            • {targetLabel(coupon.target)} • {coupon.enabled ? "Ativo" : "Desativado"}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:justify-end">
          <Button className="min-w-28" disabled={isSaving} onClick={onSave} type="button" variant="secondary">
            {isSaving ? "Salvando..." : coupon.id ? "Salvar" : "Criar"}
          </Button>
          {onDelete ? (
            <Button aria-label="Remover cupom" disabled={isDeleting} onClick={onDelete} type="button" variant="ghost">
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label>Codigo</Label>
          <Input
            onChange={(event) => onChange({ ...coupon, code: event.target.value.toUpperCase() })}
            placeholder="TESTE30"
            value={coupon.code}
          />
        </div>
        <div className="space-y-2">
          <Label>Titulo interno</Label>
          <Input
            onChange={(event) => onChange({ ...coupon, title: event.target.value })}
            placeholder="Prorrogar avaliacao"
            value={coupon.title}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de acesso</Label>
          <Select
            onChange={(event) => onChange({ ...coupon, target: event.target.value as AccessCouponTarget })}
            value={coupon.target}
          >
            <option value="trial">Prorrogar avaliacao</option>
            <option value="subscription">Prorrogar assinatura premium</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dias adicionados</Label>
          <Input
            inputMode="numeric"
            min={1}
            onChange={(event) => onChange({ ...coupon, days: Number(event.target.value) })}
            type="number"
            value={coupon.days}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            onChange={(event) => onChange({ ...coupon, enabled: event.target.value === "true" })}
            value={String(coupon.enabled)}
          >
            <option value="true">Ativo</option>
            <option value="false">Desativado</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Uso por conta</Label>
          <Input
            inputMode="numeric"
            min={1}
            onChange={(event) => onChange({ ...coupon, maxRedemptionsPerTenant: Number(event.target.value) })}
            type="number"
            value={coupon.maxRedemptionsPerTenant}
          />
        </div>
        <div className="space-y-2">
          <Label>Uso por usuario</Label>
          <Input
            inputMode="numeric"
            min={1}
            onChange={(event) => onChange({ ...coupon, maxRedemptionsPerUser: Number(event.target.value) })}
            type="number"
            value={coupon.maxRedemptionsPerUser}
          />
        </div>
        <div className="space-y-2">
          <Label>Limite global</Label>
          <Input
            inputMode="numeric"
            min={1}
            onChange={(event) =>
              onChange({ ...coupon, maxRedemptions: event.target.value ? Number(event.target.value) : null })
            }
            placeholder="Sem limite"
            type="number"
            value={coupon.maxRedemptions ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Disponivel a partir de</Label>
          <Input
            onChange={(event) => onChange({ ...coupon, startsAt: event.target.value || null })}
            type="datetime-local"
            value={formatDateInput(coupon.startsAt)}
          />
        </div>
        <div className="space-y-2">
          <Label>Expira em</Label>
          <Input
            onChange={(event) => onChange({ ...coupon, endsAt: event.target.value || null })}
            type="datetime-local"
            value={formatDateInput(coupon.endsAt)}
          />
        </div>
      </div>

      <Input
        aria-label="Descricao do cupom"
        className="mt-3"
        onChange={(event) => onChange({ ...coupon, description: event.target.value })}
        placeholder="Descricao curta para auditoria e suporte"
        value={coupon.description}
      />
    </article>
  );
}

export function AccessCouponsCard() {
  const queryClient = useQueryClient();
  const couponsQuery = useQuery({
    queryKey: ["admin-access-coupons"],
    queryFn: getAccessCoupons
  });
  const [drafts, setDrafts] = useState<Record<string, AccessCouponDraft>>({});
  const [newCoupon, setNewCoupon] = useState<AccessCouponDraft>(emptyCouponDraft);

  const couponList = useMemo(() => couponsQuery.data ?? [], [couponsQuery.data]);

  const invalidateCoupons = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-access-coupons"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createAccessCoupon,
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Cupom criado");
      setNewCoupon(emptyCouponDraft);
      await invalidateCoupons();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = useMutation({
    mutationFn: updateAccessCoupon,
    onSuccess: async (payload, variables) => {
      toast.success(payload.message ?? "Cupom atualizado");
      if (variables.id) {
        setDrafts((current) => {
          const next = { ...current };
          delete next[variables.id!];
          return next;
        });
      }
      await invalidateCoupons();
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccessCoupon,
    onSuccess: async (payload, couponId) => {
      toast.success(payload.message ?? "Cupom removido");
      setDrafts((current) => {
        const next = { ...current };
        delete next[couponId];
        return next;
      });
      await invalidateCoupons();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <section className="surface content-section admin-content-section">
      <details className="admin-disclosure">
        <summary className="admin-disclosure-summary">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Cupons de acesso</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Prorrogacao de avaliacao e assinatura</h2>
          <p className="mt-2 text-pretty text-sm leading-7 text-[var(--color-muted-foreground)]">
              Crie codigos que adicionam dias ao periodo de avaliacao ou ao acesso premium, com limite por conta e
              auditoria de cada resgate.
            </p>
          </div>
          <article className="metric-card admin-section-metric admin-disclosure-metric">
            <p className="metric-label">Ativos</p>
            <p className="metric-value">{couponList.filter((coupon) => coupon.enabled).length}</p>
          </article>
        </summary>

        <div className="admin-disclosure-body">
          {couponsQuery.isLoading ? (
            <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">Carregando cupons de acesso...</p>
          ) : null}

          <div className="mt-6">
            <CouponEditor
              coupon={newCoupon}
              isSaving={createMutation.isPending}
              onChange={setNewCoupon}
              onSave={() => createMutation.mutate(newCoupon)}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="text-sm font-semibold">Cupons cadastrados</p>
              <p className="mt-1 text-pretty text-sm text-[var(--color-muted-foreground)]">
                O historico de resgate fica preservado mesmo quando um cupom e desativado.
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setNewCoupon({ ...emptyCouponDraft, code: `ACESSO${Date.now().toString(36).toUpperCase()}` })}
              type="button"
              variant="ghost"
            >
              <Plus className="size-4" />
              Sugerir codigo
            </Button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {couponList.length ? (
              couponList.map((coupon) => {
                const draft = drafts[coupon.id!] ?? coupon;

                return (
                  <CouponEditor
                    coupon={draft}
                    isDeleting={deleteMutation.isPending}
                    isSaving={updateMutation.isPending}
                    key={coupon.id}
                    onChange={(nextDraft) => setDrafts((current) => ({ ...current, [coupon.id!]: nextDraft }))}
                    onDelete={() => {
                      if (coupon.id && window.confirm("Remover este cupom de acesso? O historico de resgate permanece.")) {
                        deleteMutation.mutate(coupon.id);
                      }
                    }}
                    onSave={() => updateMutation.mutate(draft)}
                  />
                );
              })
            ) : (
              <div className="muted-panel text-sm text-[var(--color-muted-foreground)]">
                Nenhum cupom de acesso cadastrado ainda.
              </div>
            )}
          </div>

          {!updateMutation.isPending && !createMutation.isPending ? (
            <div className="mt-5 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
              <CheckCircle2 className="size-4" />
              Cupons sao aplicados em transacao unica, com limite por conta antes de alterar a licenca.
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
