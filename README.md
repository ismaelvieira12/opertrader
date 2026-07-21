# 🐺 Tabela da Lobo

Site estático para registrar e acompanhar o histórico das minhas operações de trade.
Feito em **HTML, CSS e JavaScript puros** — sem dependências, sem build, funciona offline.

## ✨ Funcionalidades

- **Placar da banca** — banca atual, lucro líquido, ROI, taxa de acerto e contagem de WIN/LOSS, tudo calculado automaticamente.
- **Gráfico de evolução da banca** — desenhado em `<canvas>`, fica verde no lucro e vermelho no prejuízo.
- **Registrar operação** — data, valor por entrada, resultado (WIN/LOSS) e lucro/perda.
- **Histórico completo** — tabela com saldo acumulado da banca a cada operação, com filtros (Todas / Wins / Losses).
- **Editar e excluir** — cada linha tem ícones para alterar (✎) ou remover (🗑) a operação.
- **Valores em dólar ($)** — o campo de digitação aceita tanto `2,50` quanto `2.50`.
- **Salvamento automático** no navegador (`localStorage`) + **Exportar/Importar** backup em JSON.
- **Título editável** — clique no nome no topo para personalizar.

## 🚀 Como usar

1. Baixe ou clone o repositório.
2. Abra o arquivo **`index.html`** no navegador (dois cliques).

> Os dados ficam salvos apenas no navegador onde você usa. Use o botão **Exportar** para guardar um backup.

## 📁 Estrutura

```
index.html   → estrutura da página
styles.css   → visual (tema escuro)
app.js       → lógica, cálculos, gráfico e persistência
```

## 🌐 Publicar online (GitHub Pages)

Depois de enviar para o GitHub, ative em **Settings → Pages → Branch: `main` / root**.
O site fica disponível em `https://ismaelvieira12.github.io/tradoper/`.
