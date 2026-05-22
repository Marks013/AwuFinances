import { requireEndUserDashboardPageUser } from "@/lib/auth/session";
import { AccountsClient } from "@/features/accounts/components/accounts-client";
import { BenefitFoodClient } from "@/features/benefits/components/benefit-food-client";
import { CardsClient } from "@/features/cards/components/cards-client";

export default async function AccountsPage() {
  await requireEndUserDashboardPageUser();

  return (
    <div className="space-y-6">
      <section className="surface content-section">
        <div className="eyebrow">Carteira</div>
        <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight">Contas, cartoes e vale</h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--color-muted-foreground)]">
          Esta tela centraliza as fontes de dinheiro e credito da rotina financeira.
        </p>
      </section>

      <details className="section-stack" open>
        <summary className="cursor-pointer list-none text-xl font-semibold text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
          Contas
        </summary>
        <div className="mt-5">
          <AccountsClient />
        </div>
      </details>

      <details className="section-stack">
        <summary className="cursor-pointer list-none text-xl font-semibold text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
          Cartoes
        </summary>
        <div className="mt-5">
          <CardsClient />
        </div>
      </details>

      <details className="section-stack">
        <summary className="cursor-pointer list-none text-xl font-semibold text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
          Vale alimentacao
        </summary>
        <div className="mt-5">
          <BenefitFoodClient />
        </div>
      </details>
    </div>
  );
}
