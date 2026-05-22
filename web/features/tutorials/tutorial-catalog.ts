export const DASHBOARD_TUTORIAL_KEY = "dashboard-guided-essentials";
export const DASHBOARD_TUTORIAL_VERSION = 1;

export type TutorialRequirement =
  | "account"
  | "card"
  | "whatsapp-feature"
  | "whatsapp-number"
  | "sharing-permission";

export type TutorialStep = {
  key: string;
  title: string;
  description: string;
  route: string;
  targetSelector: string;
  primaryLabel: string;
  requirements?: TutorialRequirement[];
  successLabel?: string;
  supportText?: string;
};

export const dashboardTutorialSteps = [
  {
    key: "dashboard-overview",
    title: "Comece pelo mes ativo",
    description:
      "O painel usa a competencia selecionada no menu. Antes de analisar saldo, fatura, recorrencia ou relatorio, confirme se o mes ativo e o periodo correto.",
    route: "/dashboard",
    targetSelector: "#main-content",
    primaryLabel: "Abrir painel",
    successLabel: "Visao geral entendida"
  },
  {
    key: "first-account",
    title: "Crie a primeira conta",
    description:
      "Despesas em Pix, dinheiro, debito, receitas e transferencias precisam de uma conta para vincular o dinheiro real. Sem conta, o lancamento fica sem destino correto.",
    route: "/dashboard/accounts",
    targetSelector: "[data-tutorial-id='account-editor']",
    primaryLabel: "Abrir contas",
    successLabel: "Conta pronta",
    supportText: "Use uma conta corrente, carteira digital ou banco principal. O saldo de referencia serve como ponto inicial."
  },
  {
    key: "pix-expense",
    title: "Lance despesa Pix com origem correta",
    description:
      "Na transacao, escolha Despesa, forma Pix, categoria e a conta de onde o dinheiro saiu. Essa combinacao alimenta painel, relatorios e categorizacao automatica.",
    route: "/dashboard/transactions",
    targetSelector: "[data-tutorial-id='transaction-editor']",
    primaryLabel: "Abrir transacoes",
    requirements: ["account"],
    successLabel: "Fluxo de Pix orientado",
    supportText: "Se a categoria ficar em branco, o sistema tenta classificar pelo historico e pelas palavras-chave."
  },
  {
    key: "card-installments",
    title: "Parcelamento depende de cartao",
    description:
      "Para parcelar, primeiro cadastre um cartao com fechamento e vencimento. Depois lance a compra como Cartao de credito e informe o numero de parcelas.",
    route: "/dashboard/accounts?view=cards",
    targetSelector: "[data-tutorial-id='card-editor']",
    primaryLabel: "Abrir cartoes",
    requirements: ["card"],
    successLabel: "Cartao pronto para parcelas",
    supportText: "O sistema usa fechamento e vencimento para jogar cada parcela na fatura correta."
  },
  {
    key: "categories",
    title: "Use categorias como memoria do sistema",
    description:
      "Categorias organizam relatorios e ajudam a IA/regras a classificar novos lancamentos. Mantenha nomes claros e revise palavras-chave quando necessario.",
    route: "/dashboard/categories",
    targetSelector: "[data-tutorial-id='categories-list']",
    primaryLabel: "Abrir categorias",
    successLabel: "Categorias mapeadas"
  },
  {
    key: "recurrences",
    title: "Recorrencias geram rotina sem retrabalho",
    description:
      "Use recorrencias para contas mensais, assinaturas e receitas fixas. Informe dia de cobranca, categoria e destino: conta para Pix/debito ou cartao para fatura.",
    route: "/dashboard/subscriptions",
    targetSelector: "[data-tutorial-id='subscription-editor']",
    primaryLabel: "Abrir recorrencias",
    requirements: ["account"],
    successLabel: "Recorrencias orientadas",
    supportText: "Se for cartao, a competencia da fatura deve respeitar fechamento e vencimento, nao a regra global comum."
  },
  {
    key: "whatsapp-and-tithe",
    title: "Configure WhatsApp e dizimo com criterio",
    description:
      "Em Ajustes voce informa o numero autorizado do assistente e decide se novas receitas devem sugerir dizimo por padrao. O WhatsApp so deve responder mensagens iniciadas pelo usuario cadastrado.",
    route: "/dashboard/settings",
    targetSelector: "[data-tutorial-id='settings-whatsapp']",
    primaryLabel: "Abrir ajustes",
    requirements: ["whatsapp-feature", "whatsapp-number"],
    successLabel: "Assistente revisado",
    supportText: "Se o plano ou a Evolution API estiverem indisponiveis, o sistema mostra o motivo antes de orientar o uso."
  },
  {
    key: "sharing",
    title: "Compartilhe a carteira apenas pelo modulo correto",
    description:
      "O convite familiar fica em Compartilhar. O familiar entra com permissoes reduzidas, e a conta titular continua controlando convites e preferencias sensiveis.",
    route: "/dashboard/sharing",
    targetSelector: "[data-tutorial-id='sharing-invite']",
    primaryLabel: "Abrir compartilhamento",
    requirements: ["sharing-permission"],
    successLabel: "Compartilhamento entendido"
  }
] satisfies TutorialStep[];
