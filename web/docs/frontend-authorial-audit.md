# Auditoria Frontend Autoral

Data: 2026-05-07

## Escopo

Analise focada em frontend para o projeto Awu Finances, usando as skills `senior-frontend`, `tailwind-design-system`, `frontend-design`, `frontend-typescript-react-nextjs` e `baseline-ui`.

O objetivo e melhorar personalidade, autoria visual e consistencia sem trocar a stack nem reescrever o design system existente.

## Base Observada

- Stack: Next.js App Router, React, TypeScript, Tailwind CSS v4, Radix primitives, `class-variance-authority`, `tailwind-merge`, `lucide-react`, `recharts` e `sonner`.
- Arquitetura: frontend concentrado em `web/`, com rotas publicas, dashboard protegido e features por dominio.
- Superficie principal: landing, planos, billing, login/cadastro, dashboard financeiro, contas, cartoes, metas, parcelas, categorias, relatorios, compartilhamento, suporte, WhatsApp e administracao.
- Sistema visual: tokens globais em `web/app/globals.css`, componentes base em `web/components/ui`, layout em `web/components/layout` e modulos funcionais em `web/features`.

## Diagnostico

O frontend ja tem uma base acima da media para um produto financeiro: ha tokens de cor, dark/light theme, componentes de UI reaproveitaveis, rotas organizadas, microcopy em portugues e uma tentativa clara de fugir da estetica generica de SaaS azul.

O ponto mais forte e a direcao de produto: o Awu Finances fala de rotina financeira, WhatsApp, antecipacao de decisoes e operacao diaria. Isso ja e autoral. O ponto a melhorar e transformar essa promessa em linguagem visual e interativa mais propria dentro do app inteiro, nao apenas na landing e nos planos.

Hoje a personalidade aparece em fragmentos:

- Paleta com ink, stone, emerald, coral, sky e gold.
- Classes globais como `page-shell`, `surface`, `section-title`, `metric-label`, `hero-amount`.
- Marca com `BrandMark` e assinatura "Inteligencia financeira diaria".
- Landing com textos bons: "Leitura financeira direta", "Operacao verticalizada", "WhatsApp como atalho principal".

Mas parte da interface ainda depende de padroes muito familiares: surfaces grandes, cards arredondados, metricas, sidebar e copy operacional. Funciona, mas pode parecer "dashboard financeiro premium" antes de parecer "Awu Finances".

## Oportunidades de Personalidade

### 1. Criar uma Linguagem de "Pontos de Decisao"

O nome Awu Finances e forte. Ele permite uma metafora de produto: cada tela ajuda o usuario a salvar um ponto da vida financeira antes que o mes desande.

Aplicacoes praticas:

- Renomear estados vazios e chamadas contextuais para a ideia de "ponto salvo", "proximo ponto", "risco antes do fechamento", "decisao do dia".
- Criar um componente de destaque para insights chamado `DecisionPoint`, `AwuInsightCard` ou `DailyCheckpoint`.
- Usar esse padrao no dashboard, relatorios, metas e cartoes.

Exemplo de direcao de microcopy:

- Em vez de "Resumo do mes": "Ponto do mes"
- Em vez de "Nenhuma transacao": "Nada saiu do trilho por aqui ainda"
- Em vez de "Relatorios": "Leitura do mes"
- Em vez de "Adicionar transacao": "Registrar movimento"

### 2. Assumir Mais Contraste Editorial no Dashboard

A landing tem mais voz que a area logada. O dashboard pode ganhar autoria com uma hierarquia mais editorial:

- Um topo diario com 1 insight principal, 2 alertas secundarios e 1 acao recomendada.
- Cards menos equivalentes entre si: nem tudo precisa ter o mesmo peso visual.
- Diferenciar "estado", "risco", "acao" e "historico" por composicao, nao so por texto.

Isso combina com financeiro porque reduz dispersao e da ao usuario uma leitura clara do que importa agora.

### 3. Evoluir o Sistema de Cores Sem Perder Sobriedade

A paleta atual e boa: stone/ink dao sobriedade, emerald ancora confianca, coral/gold/sky trazem calor. O proximo passo e formalizar papeis semanticos mais autorais:

- `signal-positive`, `signal-warning`, `signal-risk`, `signal-info`
- `checkpoint`, `forecast`, `commitment`, `automation`
- gradientes pontuais apenas para momentos de enfase, nao como fundo padrao

Evitar aumentar o uso de cards bege/verde em tudo. A assinatura visual deve vir de contraste, densidade e componentes proprios, nao de repetir a mesma familia de tons.

### 4. Transformar WhatsApp em Elemento de Identidade

O WhatsApp e uma diferenca real do produto. Hoje ele aparece como feature; pode virar linguagem operacional:

- Uma trilha visual para comandos recebidos, classificados e conciliados.
- Componentes de conversa financeira com estados: "entendido", "precisa confirmar", "registrado".
- Uma area no dashboard com "atalhos conversacionais" em vez de simples cards.

Isso da personalidade porque nenhum dashboard financeiro tradicional costuma tratar o canal como parte central da experiencia.

### 5. Dar Mais Materialidade ao BrandMark

`BrandMark` ja existe e e um bom ponto de partida. Melhorias possiveis:

- Criar variantes para favicon/app icon, sidebar compacta, empty states e loading.
- Fazer o simbolo participar de estados: checkpoint salvo, alerta, sincronizacao, mes fechado.
- Definir uma regra de uso: o brand mark aparece em momentos de orientacao, nao como decoracao repetida.

## Melhorias de UI Prioritarias

### Prioridade 1: Design Tokens e Componentes de Assinatura

Arquivos principais:

- `web/app/globals.css`
- `web/components/layout/brand-mark.tsx`
- `web/components/ui/button.tsx`
- `web/features/dashboard`

Entregas recomendadas:

- Formalizar tokens semanticos de status e contexto.
- Criar 2 ou 3 componentes autorais pequenos: `DecisionPoint`, `FinancialSignal`, `ConversationCommand`.
- Documentar exemplos de uso em uma pagina interna ou Storybook se o projeto adotar.

### Prioridade 2: Dashboard Como Produto, Nao Apenas Painel

Arquivos principais:

- `web/app/(protected)/dashboard/page.tsx`
- `web/features/dashboard`
- `web/components/layout/dashboard-shell.tsx`

Entregas recomendadas:

- Reestruturar o primeiro viewport do dashboard com uma leitura principal.
- Reduzir equivalencia visual entre cards.
- Trazer um bloco "Hoje no seu dinheiro" com linguagem propria.

### Prioridade 3: Empty States e Microcopy

Arquivos principais:

- `web/features/accounts`
- `web/features/cards`
- `web/features/goals`
- `web/features/installments`
- `web/features/transactions`
- `web/features/whatsapp`

Entregas recomendadas:

- Criar biblioteca de empty states por dominio.
- Trocar textos genericos por textos de rotina financeira.
- Incluir uma acao primaria clara em cada vazio.

### Prioridade 4: Consistencia de Geometria

Ha muitos valores arbitrarios como `rounded-[42px]`, `rounded-[32px]`, `rounded-[30px]`, `tracking-[-0.06em]` e grids com proporcoes especificas. Eles funcionam visualmente, mas podem virar ruido se crescerem sem regra.

Entregas recomendadas:

- Definir escala curta para raios: compacto, card, painel, hero.
- Evitar tracking negativo agressivo dentro de paineis densos.
- Manter arbitrariedades apenas em telas editoriais, como landing.

## Direcao Autoral Sugerida

Awu Finances deve parecer menos "planilha bonita" e mais "mesa de controle financeiro diario".

Principios:

- Clareza antes de ornamentacao.
- Uma decisao principal por tela.
- Financeiro com calor humano, sem perder precisao.
- WhatsApp como motor operacional, nao apenas integracao.
- Marca presente nos momentos de orientacao e confirmacao.

Frase norteadora:

> Awu Finances organiza o dinheiro em pontos claros de decisao: o que aconteceu, o que mudou e o que precisa ser feito agora.

## Sequencia Recomendada de Execucao

1. Criar tokens semanticos e componentes autorais pequenos.
2. Aplicar no dashboard principal.
3. Revisar empty states e microcopy das features.
4. Refinar landing/planos para alinhar promessa publica com experiencia logada.
5. Rodar `npm run typecheck`, `npm run lint` e verificacao visual nas telas principais.

## Riscos

- Reescrever `globals.css` de uma vez pode gerar regressao ampla.
- Personalidade visual demais em financeiro pode reduzir legibilidade.
- Componentes autorais sem padrao podem aumentar inconsistencia.
- Alterar microcopy de fluxos sensiveis, como billing e auth, exige cuidado para nao reduzir clareza juridica/operacional.

## Conclusao

O projeto nao precisa de uma mudanca estetica radical. Ele precisa cristalizar a personalidade que ja existe: "pontos de decisao financeira" com WhatsApp como acelerador de rotina.

A melhor melhoria autoral e criar uma pequena camada de componentes e linguagem propria em cima do sistema atual, comecando pelo dashboard e depois espalhando para estados vazios, relatorios e automacoes.
