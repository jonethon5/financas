# Finanças da Casa

App (PWA) para lançar as contas da casa todo mês, dividir entre os moradores e saber quem deve quanto.
Funciona no navegador do computador e pode ser instalado no celular.

- **Sem e-mail:** cada morador entra com **usuário e senha** criados pelo administrador.
- **Contas fixas automáticas** (água, luz, telefone, internet) todo mês, com empresa, código do cliente e link da 2ª via.
- **Código de barras:** cole a linha digitável e o app preenche valor e vencimento (boleto e conta de consumo). Botão **Copiar código** para pagar no app do banco.
- **Alertas de vencimento** na tela e notificação no celular (3 dias antes, 1 dia antes, no dia — você escolhe).
- **Divisão** igual, por percentual ou por valores, sempre fechando no centavo.
- **Histórico**, comparação com o mês anterior e **fechamento do mês**.
- **Assistente** (Gemini): pergunte "quem deve para quem?" ou "quanto gastamos de luz?". Só consulta, 20 perguntas por dia.

**Tudo gratuito:** Supabase (plano Free), GitHub Pages, GitHub Actions e Gemini (Google AI Studio). Nenhum pede cartão de crédito.

> ⚠️ Este repositório é **público**. Nunca coloque aqui senhas, o arquivo `.env`, chaves Pix, códigos de cliente
> ou valores reais. Os dados da casa ficam só no banco do Supabase, protegidos por Row Level Security (RLS).

## Modo demonstração

Enquanto o Supabase não estiver configurado, o site publicado abre em **modo demonstração**: dados de exemplo,
guardados só no próprio aparelho. Dá para testar tudo (lançar, marcar como paga, colar código de barras…).

## Etapas

- [x] 1. Setup, PWA, login e deploy
- [x] 2. Contas fixas, extras, divisão, código de barras e alertas
- [x] 3. Histórico, comparativo com o mês anterior e fechamento do mês *(tela "Ano" vem na etapa 5)*
- [ ] 4. Acerto entre moradores, WhatsApp e exportar
- [ ] 5. Gráficos e tela do ano *(lembretes com o app fechado já estão prontos)*
- [x] 6. Assistente de IA (Gemini via Edge Function)

---

## Ligar o Supabase (uma vez só, ~10 minutos)

### 1. Criar o projeto

1. Crie uma conta em <https://supabase.com> (plano Free).
2. **New project** → nome `financas`, região **South America (São Paulo)**.
   Crie uma **senha do banco** forte e guarde (vai virar o secret `SUPABASE_DB_PASSWORD`).
3. Quando o projeto terminar de criar, vá em **Project Settings → API Keys** e copie:
   - a **Project URL** (`https://xxxx.supabase.co`)
   - a chave **anon / publishable** (é pública por natureza; quem protege os dados é o RLS)
4. Em <https://supabase.com/dashboard/account/tokens> → **Generate new token** → copie o token.

> Nunca use a chave `service_role` / `secret` no app. Ela fica só dentro do Supabase.

### 2. Cadastrar os secrets no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | chave anon / publishable |
| `SUPABASE_ACCESS_TOKEN` | o token do passo 1.4 |
| `SUPABASE_DB_PASSWORD` | a senha do banco do passo 1.2 |
| `SETUP_CODE` | invente um código qualquer (ex.: `casa-2026-xyz`). Ele protege a primeira configuração. |
| `GEMINI_API_KEY` | *(opcional, para o assistente)* chave criada em <https://aistudio.google.com/apikey> → **Create API key**. Grátis, sem cartão. |

### 3. Rodar os workflows

1. **Actions → Supabase (banco e funções) → Run workflow.** Ele cria as tabelas, publica as funções e desativa o
   cadastro público.
2. **Actions → Deploy no GitHub Pages → Run workflow.** Agora o site sai do modo demonstração.

### 4. Primeiro acesso

1. Abra o app → **Primeira vez? Configurar o app**.
2. Digite o `SETUP_CODE`, o nome da casa, seu nome, seu **usuário** e sua **senha**. Você vira o administrador.
3. Em **Ajustes → Moradores → Adicionar**, cadastre cada pessoa. Depois toque nela → **Criar acesso** e defina
   usuário e senha (pode ser só números, mínimo 6). Quem não usa o app pode ficar sem acesso e participa da divisão
   normalmente.
4. Em **Ajustes → Contas fixas**, ajuste empresa, código do cliente/instalação, link da 2ª via e dia de vencimento.

Esqueceu a senha? O administrador cria uma nova em **Ajustes → Moradores → (pessoa) → Trocar senha**.

> Como funciona sem e-mail: o Supabase Auth exige um e-mail, então o app usa um endereço interno derivado do
> usuário (`maria@moradores.financas.local`). Ele nunca recebe mensagens e ninguém precisa saber dele.

---

## Assistente (Gemini)

A tela **Perguntar** responde dúvidas sobre as contas ("quanto cada um paga?", "quem deve para quem?",
"quanto gastamos de luz nos últimos 3 meses?").

- A chave `GEMINI_API_KEY` fica só nos secrets das Edge Functions (o workflow "Supabase" copia do GitHub). Nunca no app.
- A função `ask` lê só os dados da casa de quem pergunta e manda para o Gemini um resumo com nomes/apelidos,
  contas, valores, vencimentos, quem pagou e a divisão. **Não manda** chave Pix, código de barras, Pix copia e cola,
  código do cliente, observações, anexos nem usuários.
- O assistente só consulta: não lança, não paga, não manda mensagens.
- Limite de **20 perguntas por pessoa por dia** (tabela `ai_usage`, contada no horário de Brasília).
- Modelo: `gemini-flash-latest` (o Google mantém esse nome apontando para o Flash mais recente). Para trocar,
  crie o secret de função `GEMINI_MODEL` no painel do Supabase (Edge Functions → Secrets).
- No plano gratuito do Gemini, o Google pode usar as perguntas para melhorar os produtos dele.

## Publicar no GitHub Pages

1. Repositório **público** (o Pages gratuito exige).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push na `main` roda os testes e publica em `https://SEU-USUARIO.github.io/financas/`.

Se o repositório tiver outro nome, não precisa mudar nada: o workflow usa o nome do repositório como caminho base.

### Manter o Supabase ativo

O plano Free pausa o projeto depois de ~7 dias sem uso. O workflow `keepalive.yml` faz uma consulta leve toda
segunda-feira (função `ping()`, que não lê nenhum dado). Se mesmo assim pausar, clique em **Restore** no painel do
Supabase (os dados não se perdem).

> O GitHub desativa workflows agendados em repositórios sem commits por 60 dias. Se receber esse e-mail, reative em
> **Actions → Manter Supabase ativo → Enable workflow**.

## Instalar no celular

- **iPhone (Safari):** abra o site → **Compartilhar** → **Adicionar à Tela de Início**.
  As notificações no iPhone só funcionam com o app instalado assim (iOS 16.4 ou mais novo).
- **Android (Chrome):** abra o site → menu ⋮ → **Instalar app**.

Depois, em **Ajustes → Avisos**, ligue o botão (o celular pede permissão uma vez).

Os avisos chegam **por volta das 8h, mesmo com o app fechado** (workflow `reminders.yml`): **5 dias antes e no dia
do vencimento**; contas vencidas e não pagas são lembradas 1 e 3 dias depois. As chaves das notificações (VAPID) são geradas sozinhas no primeiro uso e ficam só no
banco. O horário pode atrasar alguns minutos (o agendador do GitHub não é exato).

O app funciona offline para consulta: mostra os últimos dados carregados.

## Código de barras: o que o app entende

- **Boleto bancário** (47 dígitos, ou 44 da barra): valida os dígitos verificadores (módulo 10 nos 3 campos e
  módulo 11 geral), lê o valor e o vencimento, incluindo o novo ciclo do fator de vencimento (reiniciou em 1000 em
  22/02/2025).
- **Conta de consumo** (48 dígitos começando com 8 — Sabesp, Enel, Vivo…): valida cada bloco (módulo 10 ou 11, pelo
  3º dígito). O valor só é preenchido quando o código traz o **valor em reais** (3º dígito 6 ou 8, padrão FEBRABAN);
  com 7 ou 9 é valor de referência e o app só avisa. O vencimento normalmente não vem no código.
- O **Pix copia e cola** muda a cada conta, então ele é guardado na conta do mês (com botão "Copiar Pix").
- **Câmera:** o botão **Escanear** lê o código de barras da conta de papel e o QR Code do Pix. Usa o leitor do
  próprio celular quando existe (Android) e, no iPhone, o ZXing (WebAssembly), carregado só ao abrir a câmera.
  Só aceita a leitura quando os dígitos verificadores conferem.

## Desenvolvimento

Precisa do Node.js 22+.

```bash
npm install
npm run dev          # http://localhost:5173/financas/  (sem .env = modo demonstração)
npm test             # testes (Vitest)
npm run build
```

Para usar um Supabase **local** (precisa do Docker):

```bash
npx supabase start                      # sobe banco, auth e storage locais e aplica as migrations
echo "SETUP_CODE=teste" > supabase/functions/.env.local
npx supabase functions serve --env-file supabase/functions/.env.local
# .env: VITE_SUPABASE_URL=http://127.0.0.1:54321 e VITE_SUPABASE_ANON_KEY=<anon key mostrada no start>
```

## Segurança

- Cadastro público desativado; só o administrador cria acessos (Edge Function `admin-users`).
- RLS ativo em **todas** as tabelas: cada pessoa só lê e grava dados da própria casa. Visitantes sem login não
  acessam nada.
- Usuário, papel (admin) e vínculo do login só mudam pelas Edge Functions, nunca direto pelo app.
- Mês fechado é bloqueado no próprio banco (gatilho), não só na tela.
- Anexos num bucket **privado**, acessível só para membros da casa.
- A primeira configuração exige o `SETUP_CODE` e só funciona uma vez.
- Nenhum segredo no repositório: `.env` está no `.gitignore`; só existe o `.env.example`.

## Estrutura

```
src/
  pages/          telas (Início, Conta, Lançar, Histórico, Ajustes, Login…)
  components/     layout, botões, campos, ícones, avisos
  data/           acesso a dados: supabaseRepo (produção) e localRepo (demonstração)
  lib/            regras puras com testes: dinheiro, divisão, acerto, código de barras, Pix, vencimentos
supabase/
  migrations/     banco (tabelas, RLS, funções)
  functions/      Edge Functions: setup (primeira configuração), admin-users (acessos),
                  push (inscrição/teste de notificações), send-reminders (avisos do dia)
                  e ask (assistente com o Gemini)
.github/workflows deploy no Pages, Supabase, avisos diários e keepalive
```
