"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TicketCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureApiResponse } from "@/lib/observability/http";

type AccessCouponRedeemCardProps = {
  canRedeem: boolean;
};

async function redeemAccessCoupon(code: string) {
  const response = await fetch("/api/billing/access-coupons/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });

  await ensureApiResponse(response, {
    fallbackMessage: "Falha ao aplicar cupom de acesso",
    method: "POST",
    path: "/api/billing/access-coupons/redeem"
  });

  return (await response.json()) as { message?: string };
}

export function AccessCouponRedeemCard({ canRedeem }: AccessCouponRedeemCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const redeemMutation = useMutation({
    mutationFn: redeemAccessCoupon,
    onSuccess: async (payload) => {
      toast.success(payload.message ?? "Cupom aplicado");
      setCode("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] })
      ]);
      router.refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <article className="data-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TicketCheck className="size-4 text-[var(--color-accent)]" />
            Cupom de acesso
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
            Use um codigo autorizado pelo suporte para prorrogar avaliacao ou dias de acesso premium da conta.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Codigo do cupom de acesso"
          disabled={!canRedeem || redeemMutation.isPending}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="CODIGO"
          value={code}
        />
        <Button
          className="w-full sm:w-auto"
          disabled={!canRedeem || redeemMutation.isPending || code.trim().length < 3}
          onClick={() => redeemMutation.mutate(code)}
          type="button"
        >
          {redeemMutation.isPending ? "Aplicando..." : "Aplicar"}
        </Button>
      </div>

      {!canRedeem ? (
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Apenas o Admin de Conta pode aplicar cupons que alteram a licenca.
        </p>
      ) : null}
    </article>
  );
}
