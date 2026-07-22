# 🐺 Tabela da Lobo

App para registrar e acompanhar o histórico de operações de trade.
Cada pessoa cria uma conta e tem o **seu próprio histórico**, salvo na nuvem e
sincronizado entre aparelhos. Front-end em **HTML, CSS e JavaScript puros**;
login e banco de dados via **[Supabase](https://supabase.com)** (plano grátis).

## ✨ Funcionalidades

- **Login / cadastro** por e-mail e senha — cada usuário vê apenas os próprios dados.
- **Placar da banca** — banca atual, lucro líquido, ROI, taxa de acerto e WIN/LOSS.
- **Gráfico de evolução da banca** desenhado em `<canvas>`.
- **Registrar, editar (✎) e excluir (🗑)** operações.
- **Valores em dólar ($)** — o campo aceita tanto `2,50` quanto `2.50`.
- **Dados na nuvem** (Supabase) + **Exportar/Importar** backup em JSON.

## 🗂️ Estrutura

```
index.html   → estrutura da página + tela de login
styles.css   → visual (tema escuro)
app.js       → lógica, cálculos, gráfico, login e acesso ao banco
config.js    → SUAS chaves do Supabase (você preenche)
schema.sql   → script que cria as tabelas no Supabase
```

## ⚙️ Configuração do banco de dados (uma vez só)

1. Crie uma conta grátis em **https://supabase.com** e um **novo projeto**
   (guarde a senha do banco que ele pedir).
2. No menu lateral, abra **SQL Editor → New query**, cole todo o conteúdo do
   arquivo [`schema.sql`](schema.sql) e clique em **Run**. Isso cria as tabelas
   e as regras de segurança.
3. Vá em **Settings (engrenagem) → API** e copie:
   - **Project URL**
   - a chave **anon / public**
4. Abra [`config.js`](config.js) e cole os dois valores nas variáveis
   `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
5. (Opcional, para testar mais rápido) Em **Authentication → Sign In / Providers
   → Email**, desligue **"Confirm email"**. Assim a conta já entra sem precisar
   confirmar por e-mail.

> A chave **anon** é pública de propósito e pode ir para o GitHub. Quem protege
> os dados são as regras de **RLS** (cada usuário só acessa as próprias linhas).

## 🚀 Como usar

Abra o **`index.html`** no navegador, **crie sua conta** e comece a registrar.
Os dados ficam salvos na sua conta e aparecem em qualquer aparelho onde você entrar.

## 🌐 Publicar online (GitHub Pages)

Em **Settings → Pages → Branch: `main` / root**. O site fica em
`https://ismaelvieira12.github.io/opertrader/` e funciona igual — o Supabase
cuida do login e do banco.
