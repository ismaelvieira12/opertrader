/* ============================================================
   Tabela da Lobo — histórico de operações (multiusuário)
   Login e banco de dados via Supabase. Cada usuário só acessa
   os próprios dados (garantido pelas regras de RLS no banco).
   ============================================================ */

/* ---------- Cliente Supabase ---------- */
let supa = null;
let user = null;

function configurado() {
  return (
    typeof SUPABASE_URL === "string" &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_URL.startsWith("http") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_ANON_KEY.includes("COLE_AQUI")
  );
}

/* ---------- Estado (cache em memória do usuário logado) ---------- */
let state = { titulo: "OPERTRADER", bancaInicial: 25, operacoes: [] };
let filtroAtual = "ALL";
let resultadoSelecionado = "WIN";
let periodoAtual = "dia";

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
  renderGanhos();
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
  ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = "middle";
  for (let i = 0; i <= linhas; i++) {
    const val = min + (i / linhas) * (max - min);
    const yy = y(val);
    ctx.strokeStyle = "rgba(56,245,228,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#6b7ba0";
    ctx.textAlign = "right";
    ctx.fillText(USD.format(val), pad.left - 8, yy);
  }

  // linha de referência da banca inicial
  const yBase = y(state.bancaInicial);
  ctx.strokeStyle = "rgba(155,140,255,0.45)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, yBase);
  ctx.lineTo(pad.left + w, yBase);
  ctx.stroke();
  ctx.setLineDash([]);

  const ultimo = serie[serie.length - 1].valor;
  const subiu = ultimo >= state.bancaInicial;
  const cor = subiu ? "#2ffb9a" : "#ff5d7a";
  const corSoft = subiu ? "rgba(47,251,154,0.22)" : "rgba(255,93,122,0.20)";

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

  // linha + pontos com brilho neon
  ctx.save();
  ctx.shadowColor = cor;
  ctx.shadowBlur = 16;

  ctx.beginPath();
  serie.forEach((p, i) => (i === 0 ? ctx.moveTo(x(i), y(p.valor)) : ctx.lineTo(x(i), y(p.valor))));
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.stroke();

  serie.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(p.valor), i === serie.length - 1 ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === serie.length - 1 ? cor : "#080c17";
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

/* ============================================================
   ABA GANHOS — resumo agrupado por período
   ============================================================ */
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const NOME_PERIODO = { dia: "dia", mes: "mês", tri: "trimestre", sem: "semestre", ano: "ano" };

// Devolve a chave (para ordenar/agrupar) e o rótulo amigável de uma data
function chavePeriodo(iso, modo) {
  const [y, m, d] = iso.split("-").map(Number);
  switch (modo) {
    case "mes": return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${MESES[m - 1]} de ${y}` };
    case "tri": { const q = Math.ceil(m / 3); return { key: `${y}-T${q}`, label: `${q}º Trimestre de ${y}` }; }
    case "sem": { const s = m <= 6 ? 1 : 2; return { key: `${y}-S${s}`, label: `${s}º Semestre de ${y}` }; }
    case "ano": return { key: `${y}`, label: `${y}` };
    default:    return { key: iso, label: fmtDataBR(iso) }; // "dia"
  }
}

// Agrupa as operações por período e soma os resultados
function agruparGanhos(modo) {
  const mapa = new Map();
  for (const o of state.operacoes) {
    const { key, label } = chavePeriodo(o.data, modo);
    let g = mapa.get(key);
    if (!g) { g = { key, label, ops: 0, wins: 0, losses: 0, lucro: 0, perda: 0 }; mapa.set(key, g); }
    g.ops++;
    if (o.resultado === "WIN") g.wins++; else g.losses++;
    g.lucro += o.lucro || 0;
    g.perda += o.perda || 0;
  }
  const arr = [...mapa.values()].map((g) => ({
    ...g,
    liquido: g.lucro - g.perda,
    taxa: g.ops ? (g.wins / g.ops) * 100 : 0,
  }));
  arr.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0)); // mais recente primeiro
  return arr;
}

let ganhoIndex = 0; // 0 = período mais recente

function renderGanhos() {
  const hero = document.getElementById("periodHero");
  const tbody = document.getElementById("tbodyPeriodo");
  const empty = document.getElementById("emptyGanhos");
  const table = document.getElementById("tabelaPeriodo");
  if (!tbody) return;

  const NOMES = { dia: "Diário", mes: "Mensal", tri: "Trimestral", sem: "Semestral", ano: "Anual" };
  document.getElementById("gKicker").textContent = NOMES[periodoAtual];

  const grupos = agruparGanhos(periodoAtual); // mais recente primeiro
  const totalGeral = grupos.reduce((s, g) => s + g.liquido, 0);
  document.getElementById("gPeriodosCount").textContent = grupos.length;
  const tg = document.getElementById("gTotalGeral");
  tg.textContent = (totalGeral < 0 ? "-" : totalGeral > 0 ? "+" : "") + fmtMoney(Math.abs(totalGeral)).replace("-", "");
  tg.className = totalGeral > 0 ? "pos" : totalGeral < 0 ? "neg" : "";

  if (grupos.length === 0) {
    hero.style.display = "none";
    table.style.display = "none";
    empty.style.display = "block";
    tbody.innerHTML = "";
    return;
  }
  hero.style.display = "";
  table.style.display = "table";
  empty.style.display = "none";

  ganhoIndex = Math.max(0, Math.min(ganhoIndex, grupos.length - 1));
  const atual = grupos[ganhoIndex];

  // navegação (◀ = mais antigo, ▶ = mais novo)
  document.getElementById("gPeriodoLabel").textContent = atual.label;
  document.getElementById("gPrev").disabled = ganhoIndex >= grupos.length - 1;
  document.getElementById("gNext").disabled = ganhoIndex <= 0;

  // resultado do período em destaque
  const net = document.getElementById("gNet");
  net.textContent = (atual.liquido < 0 ? "-" : atual.liquido > 0 ? "+" : "") + fmtMoney(Math.abs(atual.liquido)).replace("-", "");
  net.className = "period-net " + (atual.liquido > 0 ? "pos" : atual.liquido < 0 ? "neg" : "");

  document.getElementById("gOps").textContent = atual.ops;
  document.getElementById("gTaxa").textContent = `${atual.taxa.toFixed(0)}%`;
  document.getElementById("gWL").textContent = `${atual.wins} / ${atual.losses}`;
  document.getElementById("gLucro").textContent = fmtMoney(atual.lucro);
  document.getElementById("gPerda").textContent = fmtMoney(atual.perda);

  // operações desse período (mais recente primeiro)
  const ops = opsOrdenadas()
    .filter((o) => chavePeriodo(o.data, periodoAtual).key === atual.key)
    .reverse();
  tbody.innerHTML = ops
    .map((o) => {
      const tag = o.resultado === "WIN"
        ? `<span class="tag tag-win">✔ WIN</span>`
        : `<span class="tag tag-loss">✖ LOSS</span>`;
      const lucroCell = o.lucro ? `<span class="pos">${fmtMoney(o.lucro)}</span>` : `<span class="muted-cell">—</span>`;
      const perdaCell = o.perda ? `<span class="neg">${fmtMoney(o.perda)}</span>` : `<span class="muted-cell">—</span>`;
      return `
        <tr>
          <td>${fmtDataBR(o.data)}</td>
          <td class="num">${fmtMoney(o.valor)}</td>
          <td class="num">${lucroCell}</td>
          <td class="num">${perdaCell}</td>
          <td class="center">${tag}</td>
        </tr>`;
    })
    .join("");
}

function navGanho(delta) {
  ganhoIndex += delta;
  renderGanhos();
}

/* ---------- Troca de abas / período ---------- */
function setView(view, btn) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
  if (btn) btn.classList.add("is-active");
  document.getElementById("viewOperacoes").hidden = view !== "operacoes";
  document.getElementById("viewGanhos").hidden = view !== "ganhos";
  if (view === "ganhos") renderGanhos();
  else renderGrafico(); // recalcula o gráfico ao voltar (canvas estava oculto)
}

function setPeriodo(p, btn) {
  periodoAtual = p;
  ganhoIndex = 0; // volta ao período mais recente ao trocar a granularidade
  document.querySelectorAll("[data-period]").forEach((c) => c.classList.remove("is-active"));
  if (btn) btn.classList.add("is-active");
  renderGanhos();
}

/* ============================================================
   CAMADA DE DADOS (Supabase)
   ============================================================ */

async function carregarDados() {
  await carregarPerfil();
  await carregarOperacoes();
}

async function carregarPerfil() {
  const { data, error } = await supa
    .from("perfil")
    .select("banca_inicial, titulo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return toast("Erro ao carregar perfil: " + error.message, "err");

  if (!data) {
    // primeiro acesso do usuário: cria o perfil padrão
    await supa.from("perfil").insert({ user_id: user.id, titulo: "OPERTRADER" });
    state.bancaInicial = 25;
    state.titulo = "OPERTRADER";
  } else {
    state.bancaInicial = Number(data.banca_inicial) || 0;
    state.titulo = data.titulo || "OPERTRADER";
    // migração: substitui nomes antigos padrão pelo novo automaticamente
    if (state.titulo === "TABELA DA LOBO" || state.titulo === "ENTRADAS OPERTRADER") {
      state.titulo = "OPERTRADER";
      await salvarPerfil();
    }
  }
}

async function carregarOperacoes() {
  const { data, error } = await supa
    .from("operacoes")
    .select("id, data, valor, resultado, lucro, perda")
    .eq("user_id", user.id)
    .order("data", { ascending: true })
    .order("id", { ascending: true });

  if (error) return toast("Erro ao carregar operações: " + error.message, "err");

  state.operacoes = (data || []).map((o) => ({
    id: o.id,
    data: o.data,
    valor: Number(o.valor),
    resultado: o.resultado,
    lucro: Number(o.lucro),
    perda: Number(o.perda),
  }));
  render();
}

async function salvarPerfil() {
  const { error } = await supa.from("perfil").upsert({
    user_id: user.id,
    banca_inicial: state.bancaInicial,
    titulo: state.titulo,
  });
  if (error) toast("Erro ao salvar: " + error.message, "err");
}

/* ---------- Ações CRUD ---------- */
async function adicionarOp(e) {
  e.preventDefault();
  if (!user) return;
  const data = document.getElementById("fData").value;
  const valor = parseMoney(document.getElementById("fValor").value);
  const resultadoVal = parseMoney(document.getElementById("fResultado").value);

  if (!data) return toast("Informe a data.", "err");
  if (isNaN(valor) || valor < 0) return toast("Valor por entrada inválido.", "err");
  if (isNaN(resultadoVal) || resultadoVal < 0) return toast("Valor do resultado inválido.", "err");

  const { error } = await supa.from("operacoes").insert({
    user_id: user.id,
    data,
    valor,
    resultado: resultadoSelecionado,
    lucro: resultadoSelecionado === "WIN" ? resultadoVal : 0,
    perda: resultadoSelecionado === "LOSS" ? resultadoVal : 0,
  });
  if (error) return toast("Erro ao salvar: " + error.message, "err");

  document.getElementById("fValor").value = "";
  document.getElementById("fResultado").value = "";
  document.getElementById("fValor").focus();
  await carregarOperacoes();
  toast(resultadoSelecionado === "WIN" ? "WIN registrado! 🟢" : "LOSS registrado. 🔴", "ok");
}

async function excluirOp(id) {
  const op = state.operacoes.find((o) => o.id === id);
  if (!op) return;
  if (!confirm(`Excluir a operação de ${fmtDataBR(op.data)}?`)) return;

  const { error } = await supa.from("operacoes").delete().eq("id", id);
  if (error) return toast("Erro ao excluir: " + error.message, "err");
  await carregarOperacoes();
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

async function salvarEdit(e) {
  e.preventDefault();
  if (editandoId == null) return fecharEdit();

  const data = document.getElementById("eData").value;
  const valor = parseMoney(document.getElementById("eValor").value);
  const resultadoVal = parseMoney(document.getElementById("eResultado").value);

  if (!data) return toast("Informe a data.", "err");
  if (isNaN(valor) || valor < 0) return toast("Valor por entrada inválido.", "err");
  if (isNaN(resultadoVal) || resultadoVal < 0) return toast("Valor do resultado inválido.", "err");

  const { error } = await supa
    .from("operacoes")
    .update({
      data,
      valor,
      resultado: resultadoEdit,
      lucro: resultadoEdit === "WIN" ? resultadoVal : 0,
      perda: resultadoEdit === "LOSS" ? resultadoVal : 0,
    })
    .eq("id", editandoId);
  if (error) return toast("Erro ao atualizar: " + error.message, "err");

  fecharEdit();
  await carregarOperacoes();
  toast("Operação atualizada. ✏️", "ok");
}

/* ---------- Toggle resultado (formulário principal) ---------- */
function setResultado(res) {
  resultadoSelecionado = res;
  document.getElementById("tgWin").classList.toggle("is-active", res === "WIN");
  document.getElementById("tgLoss").classList.toggle("is-active", res === "LOSS");
  document.getElementById("labelResultado").textContent = res === "WIN" ? "Lucro ($)" : "Perda ($)";
}

/* ---------- Filtro da tabela ---------- */
function setFiltro(f, btn) {
  filtroAtual = f;
  document.querySelectorAll("[data-filter]").forEach((c) => c.classList.remove("is-active"));
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
async function salvarConfig() {
  const v = parseMoney(document.getElementById("mBancaInicial").value);
  state.bancaInicial = isNaN(v) ? 0 : v;
  fecharConfig();
  render();
  await salvarPerfil();
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
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.operacoes)) throw new Error("formato");

      const linhas = data.operacoes.map((o) => ({
        user_id: user.id,
        data: o.data,
        valor: Number(o.valor) || 0,
        resultado: o.resultado === "LOSS" ? "LOSS" : "WIN",
        lucro: Number(o.lucro) || 0,
        perda: Number(o.perda) || 0,
      }));

      if (linhas.length) {
        const { error } = await supa.from("operacoes").insert(linhas);
        if (error) throw error;
      }
      if (data.bancaInicial != null || data.titulo) {
        state.bancaInicial = Number(data.bancaInicial) || state.bancaInicial;
        state.titulo = data.titulo || state.titulo;
        await salvarPerfil();
      }
      await carregarDados();
      toast("Dados importados com sucesso.", "ok");
    } catch (err) {
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
  const commit = async () => {
    const txt = h1.textContent.trim() || "OPERTRADER";
    h1.textContent = txt;
    if (txt === state.titulo) return;
    state.titulo = txt;
    if (user) await salvarPerfil();
  };
  h1.addEventListener("blur", commit);
  h1.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); h1.blur(); }
  });
}

/* ============================================================
   AUTENTICAÇÃO
   ============================================================ */

function authMsg(msg, tipo = "") {
  const el = document.getElementById("authMsg");
  el.textContent = msg;
  el.className = "auth-msg " + tipo;
}

function traduzErro(m) {
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(m)) return "Este e-mail já tem conta. Tente entrar.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return m;
}

async function entrar(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const senha = document.getElementById("authSenha").value;
  if (!email || !senha) return authMsg("Preencha e-mail e senha.", "err");

  authMsg("Entrando...");
  const { error } = await supa.auth.signInWithPassword({ email, password: senha });
  if (error) authMsg(traduzErro(error.message), "err");
  // sucesso → o listener onAuthStateChange carrega o app
}

async function criarConta() {
  const email = document.getElementById("authEmail").value.trim();
  const senha = document.getElementById("authSenha").value;
  if (!email || senha.length < 6) return authMsg("Informe um e-mail válido e senha de 6+ caracteres.", "err");

  authMsg("Criando conta...");
  const { data, error } = await supa.auth.signUp({ email, password: senha });
  if (error) return authMsg(traduzErro(error.message), "err");

  if (data.session) authMsg("Conta criada! Entrando...", "ok");
  else authMsg("Conta criada! Confirme pelo link enviado ao seu e-mail e depois faça login.", "ok");
}

async function sair() {
  await supa.auth.signOut();
  toast("Você saiu.", "ok");
}

async function aplicarSessao(session) {
  user = session?.user ?? null;
  const app = document.querySelector(".app");
  const auth = document.getElementById("authScreen");

  if (user) {
    auth.hidden = true;
    app.hidden = false;
    document.getElementById("userEmail").textContent = user.email;
    document.getElementById("authSenha").value = "";
    await carregarDados();
  } else {
    app.hidden = true;
    auth.hidden = false;
    state = { titulo: "OPERTRADER", bancaInicial: 25, operacoes: [] };
  }
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

function wireEvents() {
  // data padrão = hoje
  document.getElementById("fData").value = new Date().toISOString().slice(0, 10);

  document.getElementById("formOp").addEventListener("submit", adicionarOp);
  document.getElementById("tgWin").addEventListener("click", () => setResultado("WIN"));
  document.getElementById("tgLoss").addEventListener("click", () => setResultado("LOSS"));

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setFiltro(btn.dataset.filter, btn));
  });
  document.querySelectorAll("[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => setPeriodo(btn.dataset.period, btn));
  });
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view, btn));
  });
  document.getElementById("gPrev").addEventListener("click", () => navGanho(1));
  document.getElementById("gNext").addEventListener("click", () => navGanho(-1));

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

  // Autenticação
  document.getElementById("formAuth").addEventListener("submit", entrar);
  document.getElementById("btnCriar").addEventListener("click", criarConta);
  document.getElementById("btnSair").addEventListener("click", sair);

  setupTitulo();
  setResultado("WIN");
  window.addEventListener("resize", renderGrafico);
}

async function boot() {
  wireEvents();

  // Supabase ainda não configurado (config.js sem chaves)
  if (!configurado()) {
    document.querySelector(".app").hidden = true;
    document.getElementById("authScreen").hidden = false;
    document.getElementById("authConfig").hidden = false;
    document
      .getElementById("formAuth")
      .querySelectorAll("input, button")
      .forEach((el) => (el.disabled = true));
    return;
  }

  // Biblioteca do Supabase não carregou (sem internet, CDN bloqueado…)
  if (!window.supabase) {
    document.querySelector(".app").hidden = true;
    document.getElementById("authScreen").hidden = false;
    authMsg("Não foi possível carregar o Supabase. Verifique sua conexão com a internet.", "err");
    return;
  }

  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // sessão atual (se o usuário já estava logado)
  const { data } = await supa.auth.getSession();
  await aplicarSessao(data.session);

  // reage a login / logout
  supa.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") aplicarSessao(session);
  });
}

document.addEventListener("DOMContentLoaded", boot);
