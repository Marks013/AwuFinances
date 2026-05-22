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
    title: "Entenda o mes que voce esta olhando",
    description:
      "Tudo no sistema segue o mes escolhido no menu: painel, transacoes, faturas, recorrencias e relatorios. Antes de conferir qualquer numero, veja se o mes ativo e o periodo que voce quer analisar.",
    route: "/dashboard",
    targetSelector: "#main-content",
    primaryLabel: "Abrir painel",
    successLabel: "Mes ativo localizado"
  },
  {
    key: "first-account",
    title: "Cadastre uma conta antes de lancar dinheiro",
    description:
      "A conta representa onde o dinheiro entra ou sai: banco, carteira digital, dinheiro em maos ou conta principal. Sem uma conta cadastrada, uma despesa Pix ou uma receita nao tem origem correta.",
    route: "/dashboard/accounts",
    targetSelector: "[data-tutorial-id='account-heading']",
    primaryLabel: "Abrir contas",
    successLabel: "Conta pronta",
    supportText: "Exemplo: cadastre PicPay, Nubank, Itau ou Carteira. O saldo de referencia e apenas o valor inicial para o sistema calcular o saldo atual."
  },
  {
    key: "pix-expense",
    title: "Como lancar uma despesa Pix",
    description:
      "Para registrar uma despesa Pix, preencha valor, descricao, tipo Despesa, forma Pix e escolha a conta de onde o dinheiro saiu. A categoria ajuda o relatorio, mas pode ser sugerida automaticamente.",
    route: "/dashboard/transactions",
    targetSelector: "[data-tutorial-id='transaction-heading']",
    primaryLabel: "Abrir transacoes",
    requirements: ["account"],
    successLabel: "Despesa Pix entendida",
    supportText: "Exemplo: mercado de R$ 25 no PicPay. A conta diz de onde saiu o dinheiro; a categoria diz para onde esse gasto aparece nos relatorios."
  },
  {
    key: "card-installments",
    title: "Cartao e necessario para compras parceladas",
    description:
      "Compra parcelada nao nasce diretamente na pagina de parcelas. Primeiro cadastre o cartao e seus dias de fechamento/vencimento. Depois lance uma transacao no Cartao de credito e informe a quantidade de parcelas.",
    route: "/dashboard/accounts?view=cards",
    targetSelector: "[data-tutorial-id='card-heading']",
    primaryLabel: "Abrir cartoes",
    requirements: ["card"],
    successLabel: "Cartao pronto para parcelas",
    supportText: "O fechamento define em qual fatura a compra entra. O vencimento define quando essa fatura deve ser paga."
  },
  {
    key: "categories",
    title: "Categorias organizam seus relatorios",
    description:
      "Categoria e o grupo do lancamento: mercado, transporte, salario, internet, lazer. Ela deixa os relatorios legiveis e ajuda o sistema a reconhecer lancamentos parecidos no futuro.",
    route: "/dashboard/categories",
    targetSelector: "[data-tutorial-id='categories-list-heading']",
    primaryLabel: "Abrir categorias",
    successLabel: "Categorias entendidas",
    supportText: "Voce pode usar as categorias padrao e so ajustar quando quiser nomes, cores ou palavras-chave mais pessoais."
  },
  {
    key: "recurrences",
    title: "Recorrencias servem para contas que se repetem",
    description:
      "Use recorrencia para algo que volta todo mes: internet, telefone, aluguel, assinatura ou salario fixo. Informe valor, dia, categoria e onde isso sera lancado: conta ou cartao.",
    route: "/dashboard/subscriptions",
    targetSelector: "[data-tutorial-id='subscription-heading']",
    primaryLabel: "Abrir recorrencias",
    requirements: ["account"],
    successLabel: "Recorrencias orientadas",
    supportText: "Se a recorrencia cair no cartao, o sistema deve olhar fechamento e vencimento da fatura para colocar a cobranca no mes correto."
  },
  {
    key: "whatsapp-and-tithe",
    title: "WhatsApp e dizimo ficam nos Ajustes",
    description:
      "Em Ajustes voce informa o numero autorizado para falar com o assistente e decide se novas receitas devem marcar dizimo por padrao. O assistente deve responder apenas numeros cadastrados na conta.",
    route: "/dashboard/settings",
    targetSelector: "[data-tutorial-id='settings-whatsapp-heading']",
    primaryLabel: "Abrir ajustes",
    requirements: ["whatsapp-feature", "whatsapp-number"],
    successLabel: "Assistente revisado",
    supportText: "Se o plano, o numero ou a conexao do assistente estiverem indisponiveis, o sistema mostra o motivo sem expor detalhes tecnicos."
  },
  {
    key: "sharing",
    title: "Compartilhe a carteira com seguranca",
    description:
      "Use o modulo Compartilhar para convidar um familiar. A pessoa entra com acesso limitado, enquanto o titular continua controlando convites e ajustes sensiveis.",
    route: "/dashboard/sharing",
    targetSelector: "[data-tutorial-id='sharing-invite-heading']",
    primaryLabel: "Abrir compartilhamento",
    requirements: ["sharing-permission"],
    successLabel: "Compartilhamento entendido",
    supportText: "Esse fluxo evita misturar senha, conta pessoal e acesso familiar. Cada pessoa usa seu proprio login."
  }
] satisfies TutorialStep[];
