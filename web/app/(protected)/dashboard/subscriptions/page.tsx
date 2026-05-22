import { requireEndUserDashboardPageUser } from "@/lib/auth/session";
import { InstallmentsClient } from "@/features/installments/components/installments-client";
import { SubscriptionsClient } from "@/features/subscriptions/components/subscriptions-client";

export default async function SubscriptionsPage() {
  await requireEndUserDashboardPageUser();

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Recorrencias</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Recorrencias e parcelas</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Esta tela centraliza compromissos que se repetem e compras parceladas.
        </p>
      </section>

      <details className="section-stack" open>
        <summary className="cursor-pointer list-none text-xl font-semibold text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
          Recorrencias
        </summary>
        <div className="mt-5">
          <SubscriptionsClient />
        </div>
      </details>

      <details className="section-stack">
        <summary className="cursor-pointer list-none text-xl font-semibold text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
          Parcelas
        </summary>
        <div className="mt-5">
          <InstallmentsClient />
        </div>
      </details>
    </div>
  );
}
