/* ============================================================
   Tabela da Lobo — histórico de operações
   Dados persistem em localStorage. Sem dependências externas.
   ============================================================ */

const STORAGE_KEY = "tradoper_state_v1";

/* ---------- Estado ---------- */
const defaultState = {
  titulo: "TABELA DA LOBO",
  bancaInicial: 25,
  operacoes: [
    // Sementes vindas da planilha original (edite/exclua à vontade)
    { id: 1, data: "2026-07-20", valor: 2.14, resultado: "LOSS", lucro: 0, perda: 2.14 },
    { id: 2, data: "2026-07-21", valor: 2.76, resultado: "WIN", lucro: 2.62, perda: 0 },
  ],
};

let state = load();
let filtroAtual = "ALL";
let resultadoSelecionado = "WIN";

/* ---------- Persistência ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      titulo: parsed.titulo ?? defaultState.titulo,
      bancaInicial: Number(parsed.bancaInicial) || 0,
      operacoes: Array.isArray(parsed.operacoes) ? parsed.operacoes : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Utilidades ---------- */
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtMoney = (n) => USD.format(n || 0);

function parseMoney(str) {
  if (typeof str === "number") return str;
  if (!str) return NaN;
  // aceita "25.00", "25,00", "1,234.56" e "1.234,56" — o último separador é o decimal
  let s = String(str).trim().replace(/[^0-9.,-]/g, "");
  if (!s) return NaN;
  const dec = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (dec === -1) return parseFloat(s);
  const intPart = s.slice(0, dec).replace(/[.,]/g, "");
  const decPart = s.slice(dec + 1).replace(/[.,]/g, "");
  return parseFloat(intPart + "." + decPart);
}

function fmtDataBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function novoId() {
  return state.operacoes.reduce((max, o) => Math.max(max, o.id), 0) + 1;
}

// operações ordenadas por data (asc) — base para saldo acumulado e gráfico
function opsOrdenadas() {
  return [...state.operacoes].sort((a, b) => {
    if (a.data === b.data) return a.id - b.id;
    return a.data < b.data ? -1 : 1;
  });
}

/* ---------- Cálculo de estatísticas ---------- */
function calcularStats() {
  const ops = state.operacoes;
  const lucroTotal = ops.reduce((s, o) => s + (o.lucro || 0), 0);
  const perdaTotal = ops.reduce((s, o) => s + (o.perda || 0), 0);
  const liquido = lucroTotal - perdaTotal;
  const wins = ops.filter((o) => o.resultado === "WIN").length;
  const losses = ops.filter((o) => o.resultado === "LOSS").length;
  const total = ops.length;
  const winrate = total ? (wins / total) * 100 : 0;
  const banca = state.bancaInicial + liquido;
  const roi = state.bancaInicial > 0 ? (liquido / state.bancaInicial) * 100 : 0;
  return { lucroTotal, perdaTotal, liquido, wins, losses, total, winrate, banca, roi };
}

/* ---------- Render principal ---------- */
function render() {
  document.getElementById("tituloApp").textContent = state.titulo;
  const s = calcularStats();

  // Cards
  document.getElementById("statBanca").textContent = fmtMoney(s.banca);
  document.getElementById("statBancaInicial").textContent = `Inicial: ${fmtMoney(state.bancaInicial)}`;

  const lucroEl = document.getElementById("statLucro");
  lucroEl.textContent = (s.liquido >= 0 ? "" : "-") + fmtMoney(Math.abs(s.liquido)).replace("-", "");
  lucroEl.className = "stat-value " + (s.liquido > 0 ? "pos" : s.liquido < 0 ? "neg" : "");

  const roiEl = document.getElementById("statRoi");
  roiEl.textContent = `ROI: ${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1).replace(".", ",")}%`;

  document.getElementById("statWinrate").textContent = `${s.winrate.toFixed(0)}%`;
  document.getElementById("winrateFill").style.width = `${s.winrate}%`;
  document.getElementById("statTotal").textContent = s.total;
  document.getElementById("statWins").textContent = s.wins;
  document.getElementById("statLosses").textContent = s.losses;

  renderTabela();
  renderGrafico();
  save();
}

/* ---------- Tabela ---------- */
function renderTabela() {
  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("emptyState");
  const table = document.getElementById("tabela");

  const ordenadas = opsOrdenadas();
  // saldo acumulado por operação
  let saldo = state.bancaInicial;
  const comSaldo = ordenadas.map((o) => {
    saldo += (o.lucro || 0) - (o.perda || 0);
    return { ...o, saldo };
  });

  // mais recentes primeiro na exibição
  let linhas = comSaldo.slice().reverse();
  if (filtroAtual !== "ALL") linhas = linhas.filter((o) => o.resultado === filtroAtual);

  if (linhas.length === 0) {
    table.style.display = "none";
    empty.style.display = "block";
    empty.querySelector("p").textContent =
      state.operacoes.length === 0
        ? "Nenhuma operação registrada ainda."
        : "Nenhuma operação neste filtro.";
    tbody.innerHTML = "";
    return;
  }
  table.style.display = "table";
  empty.style.display = "none";

  tbody.innerHTML = linhas
    .map((o) => {
      const isWin = o.resultado === "WIN";
      const tag = isWin
        ? `<span class="tag tag-win">✔ WIN</span>`
        : `<span class="tag tag-loss">✖ LOSS</span>`;
      const lucroCell = o.lucro
        ? `<span class="pos">${fmtMoney(o.lucro)}</span>`
        : `<span class="muted-cell">—</span>`;
      const perdaCell = o.perda
        ? `<span class="neg">${fmtMoney(o.perda)}</span>`
        : `<span class="muted-cell">—</span>`;
      return `
        <tr>
          <td>${fmtDataBR(o.data)}</td>
          <td class="num">${fmtMoney(o.valor)}</td>
          <td class="num">${lucroCell}</td>
          <td class="num">${perdaCell}</td>
          <td class="center">${tag}</td>
          <td class="num"><b>${fmtMoney(o.saldo)}</b></td>
          <td class="center">
            <div class="row-actions">
              <button class="icon-btn" data-edit="${o.id}" title="Editar">✎</button>
              <button class="icon-btn danger" data-del="${o.id}" title="Excluir">🗑</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => abrirEdit(Number(btn.dataset.edit)));
  });
  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => excluirOp(Number(btn.dataset.del)));
  });
}

/* ---------- Gráfico (canvas, sem libs) ---------- */
function renderGrafico() {
  const canvas = document.getElementById("grafico");
  const note = document.getElementById("chartNote");
  const ctx = canvas.getContext("2d");

  const ordenadas = opsOrdenadas();
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = 300;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (ordenadas.length === 0) {
    note.textContent = "Registre operações para ver o gráfico";
    return;
  }
  note.textContent = `${ordenadas.length} ${ordenadas.length === 1 ? "operação" : "operações"}`;

  // série: ponto inicial (banca inicial) + saldo após cada operação
  let saldo = state.bancaInicial;
  const serie = [{ label: "Início", valor: saldo }];
  ordenadas.forEach((o) => {
    saldo += (o.lucro || 0) - (o.perda || 0);
    serie.push({ label: fmtDataBR(o.data), valor: saldo });
  });

  const pad = { top: 18, right: 16, bottom: 26, left: 62 };
  const w = cssW - pad.left - pad.right;
  const h = cssH - pad.top - pad.bottom;

  const valores = serie.map((p) => p.valor);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  min -= range * 0.12;
  max += range * 0.12;

  const x = (i) => pad.left + (serie.length === 1 ? w / 2 : (i / (serie.length - 1)) * w);
  const y = (v) => pad.top + h - ((v - min) / (max - min)) * h;

  // grade horizontal + labels do eixo Y
  const linhas = 4;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= linhas; i++) {
    const val = min + (i / linhas) * (max - min);
    const yy = y(val);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#61708b";
    ctx.textAlign = "right";
    ctx.fillText(USD.format(val), pad.left - 8, yy);
  }

  // linha de referência da banca inicial
  const yBase = y(state.bancaInicial);
  ctx.strokeStyle = "rgba(138,153,179,0.35)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, yBase);
  ctx.lineTo(pad.left + w, yBase);
  ctx.stroke();
  ctx.setLineDash([]);

  const ultimo = serie[serie.length - 1].valor;
  const subiu = ultimo >= state.bancaInicial;
  const cor = subiu ? "#2ee27b" : "#f0524b";
  const corSoft = subiu ? "rgba(46,226,123,0.18)" : "rgba(240,82,75,0.16)";

  // área preenchida
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
  grad.addColorStop(0, corSoft);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  serie.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.valor)) : ctx.lineTo(x(i), y(p.valor))));
  ctx.lineTo(x(serie.length - 1), pad.top + h);
  ctx.lineTo(x(0), pad.top + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // linha
  ctx.beginPath();
  serie.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.valor)) : ctx.lineTo(x(i), y(p.valor))));
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.stroke();

  // pontos
  serie.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(p.valor), i === serie.length - 1 ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === serie.length - 1 ? cor : "#0a0e17";
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
}

/* ---------- Ações CRUD ---------- */
function adicionarOp(e) {
  e.preventDefault();
  const data = document.getElementById("fData").value;
  const valor = parseMoney(document.getElementById("fValor").value);
  const resultadoVal = parseMoney(document.getElementById("fResultado").value);

  if (!data) return toast("Informe a data.", "err");
  if (isNaN(valor) || valor < 0) return toast("Valor por entrada inválido.", "err");
  if (isNaN(resultadoVal) || resultadoVal < 0) return toast("Valor do resultado inválido.", "err");

  const op = {
    id: novoId(),
    data,
    valor,
    resultado: resultadoSelecionado,
    lucro: resultadoSelecionado === "WIN" ? resultadoVal : 0,
    perda: resultadoSelecionado === "LOSS" ? resultadoVal : 0,
  };
  state.operacoes.push(op);
  render();

  document.getElementById("fValor").value = "";
  document.getElementById("fResultado").value = "";
  document.getElementById("fValor").focus();
  toast(resultadoSelecionado === "WIN" ? "WIN registrado! 🟢" : "LOSS registrado. 🔴", "ok");
}

function excluirOp(id) {
  const op = state.operacoes.find((o) => o.id === id);
  if (!op) return;
  if (!confirm(`Excluir a operação de ${fmtDataBR(op.data)}?`)) return;
  state.operacoes = state.operacoes.filter((o) => o.id !== id);
  render();
  toast("Operação excluída.", "ok");
}

/* ---------- Editar operação (modal) ---------- */
let editandoId = null;
let resultadoEdit = "WIN";

function abrirEdit(id) {
  const op = state.operacoes.find((o) => o.id === id);
  if (!op) return;
  editandoId = id;
  document.getElementById("eData").value = op.data;
  document.getElementById("eValor").value = op.valor.toFixed(2);
  setResultadoEdit(op.resultado);
  document.getElementById("eResultado").value = (op.resultado === "WIN" ? op.lucro : op.perda).toFixed(2);
  document.getElementById("modalEdit").hidden = false;
  document.getElementById("eValor").focus();
}

function setResultadoEdit(res) {
  resultadoEdit = res;
  document.getElementById("etgWin").classList.toggle("is-active", res === "WIN");
  document.getElementById("etgLoss").classList.toggle("is-active", res === "LOSS");
  document.getElementById("eLabelResultado").textContent = res === "WIN" ? "Lucro ($)" : "Perda ($)";
}

function fecharEdit() {
  document.getElementById("modalEdit").hidden = true;
  editandoId = null;
}

function salvarEdit(e) {
  e.preventDefault();
  const op = state.operacoes.find((o) => o.id === editandoId);
  if (!op) return fecharEdit();

  const data = document.getElementById("eData").value;
  const valor = parseMoney(document.getElementById("eValor").value);
  const resultadoVal = parseMoney(document.getElementById("eResultado").value);

  if (!data) return toast("Informe a data.", "err");
  if (isNaN(valor) || valor < 0) return toast("Valor por entrada inválido.", "err");
  if (isNaN(resultadoVal) || resultadoVal < 0) return toast("Valor do resultado inválido.", "err");

  op.data = data;
  op.valor = valor;
  op.resultado = resultadoEdit;
  op.lucro = resultadoEdit === "WIN" ? resultadoVal : 0;
  op.perda = resultadoEdit === "LOSS" ? resultadoVal : 0;

  fecharEdit();
  render();
  toast("Operação atualizada. ✏️", "ok");
}

/* ---------- Toggle resultado ---------- */
function setResultado(res) {
  resultadoSelecionado = res;
  document.getElementById("tgWin").classList.toggle("is-active", res === "WIN");
  document.getElementById("tgLoss").classList.toggle("is-active", res === "LOSS");
  document.getElementById("labelResultado").textContent = res === "WIN" ? "Lucro ($)" : "Perda ($)";
}

/* ---------- Filtro da tabela ---------- */
function setFiltro(f, btn) {
  filtroAtual = f;
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
  btn.classList.add("is-active");
  renderTabela();
}

/* ---------- Banca inicial (modal) ---------- */
function abrirConfig() {
  document.getElementById("mBancaInicial").value = state.bancaInicial
    ? state.bancaInicial.toFixed(2)
    : "";
  document.getElementById("modalConfig").hidden = false;
  document.getElementById("mBancaInicial").focus();
}
function fecharConfig() {
  document.getElementById("modalConfig").hidden = true;
}
function salvarConfig() {
  const v = parseMoney(document.getElementById("mBancaInicial").value);
  state.bancaInicial = isNaN(v) ? 0 : v;
  fecharConfig();
  render();
  toast("Banca inicial atualizada.", "ok");
}

/* ---------- Exportar / Importar ---------- */
function exportar() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tabela-da-lobo.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado.", "ok");
}

function importar(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.operacoes)) throw new Error("formato");
      state = {
        titulo: data.titulo ?? state.titulo,
        bancaInicial: Number(data.bancaInicial) || 0,
        operacoes: data.operacoes.map((o, i) => ({
          id: o.id ?? i + 1,
          data: o.data,
          valor: Number(o.valor) || 0,
          resultado: o.resultado === "LOSS" ? "LOSS" : "WIN",
          lucro: Number(o.lucro) || 0,
          perda: Number(o.perda) || 0,
        })),
      };
      render();
      toast("Dados importados com sucesso.", "ok");
    } catch {
      toast("Arquivo inválido.", "err");
    }
  };
  reader.readAsText(file);
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, tipo = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + tipo;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast " + tipo;
    setTimeout(() => (el.hidden = true), 250);
  }, 2400);
}

/* ---------- Título editável ---------- */
function setupTitulo() {
  const h1 = document.getElementById("tituloApp");
  const commit = () => {
    const txt = h1.textContent.trim() || "TABELA DA LOBO";
    h1.textContent = txt;
    state.titulo = txt;
    save();
  };
  h1.addEventListener("blur", commit);
  h1.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); h1.blur(); }
  });
}

/* ---------- Init ---------- */
function init() {
  // data padrão = hoje
  document.getElementById("fData").value = new Date().toISOString().slice(0, 10);

  document.getElementById("formOp").addEventListener("submit", adicionarOp);
  document.getElementById("tgWin").addEventListener("click", () => setResultado("WIN"));
  document.getElementById("tgLoss").addEventListener("click", () => setResultado("LOSS"));

  document.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => setFiltro(btn.dataset.filter, btn));
  });

  document.getElementById("btnConfig").addEventListener("click", abrirConfig);
  document.getElementById("mSalvar").addEventListener("click", salvarConfig);
  document.getElementById("mCancelar").addEventListener("click", fecharConfig);
  document.getElementById("modalConfig").addEventListener("click", (e) => {
    if (e.target.id === "modalConfig") fecharConfig();
  });
  document.getElementById("mBancaInicial").addEventListener("keydown", (e) => {
    if (e.key === "Enter") salvarConfig();
  });

  document.getElementById("formEdit").addEventListener("submit", salvarEdit);
  document.getElementById("etgWin").addEventListener("click", () => setResultadoEdit("WIN"));
  document.getElementById("etgLoss").addEventListener("click", () => setResultadoEdit("LOSS"));
  document.getElementById("eCancelar").addEventListener("click", fecharEdit);
  document.getElementById("modalEdit").addEventListener("click", (e) => {
    if (e.target.id === "modalEdit") fecharEdit();
  });

  document.getElementById("btnExportar").addEventListener("click", exportar);
  document.getElementById("btnImportar").addEventListener("click", () =>
    document.getElementById("inputImportar").click()
  );
  document.getElementById("inputImportar").addEventListener("change", (e) => {
    if (e.target.files[0]) importar(e.target.files[0]);
    e.target.value = "";
  });

  setupTitulo();
  setResultado("WIN");
  render();

  window.addEventListener("resize", renderGrafico);
}

document.addEventListener("DOMContentLoaded", init);
