/* Devolução de Livros — Biblioteca Itinerante (Realtime Database)
   Ao confirmar:
   - livros/{id}: volta para "disponivel" (status Livre), limpa dados da aluna
   - emprestimos/{emprestimoId}: status "devolvido" + data da devolução */
import { db } from "./firebase-config.js";
import { ref, update, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

let livros = [];
let pendente = null;
const PRAZO_DIAS = 15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);

const CAMPOS = {
  codigo: ["codigo", "numero", "numeroCodigo"],
  titulo: ["titulo", "title"],
  autor: ["autor", "autora", "autor(a)"],
  aluna: ["aluna", "nomeAluna", "alunaNome", "reservadoPara"],
  dataReserva: ["dataReserva", "data_reserva", "reservadoEm", "dataEmprestimo", "dataInicio"],
  dataDevolucao: ["dataDevolucao", "data_devolucao", "devolvidoEm", "dataDevolvido"]
};

const SITUACOES = {
  livre:      { chave: "livre",      icone: "🟢", rotulo: "Livre" },
  emprestado: { chave: "emprestado", icone: "🟡", rotulo: "Emprestado" },
  atrasado:   { chave: "atrasado",   icone: "🔴", rotulo: "Atrasado" }
};

function valor(obj, ...chaves) {
  for (const c of chaves) if (obj[c] !== undefined && obj[c] !== null) return String(obj[c]);
  return "";
}
function bruto(obj, ...chaves) {
  for (const c of chaves) if (obj[c] !== undefined && obj[c] !== null && obj[c] !== "") return obj[c];
  return null;
}
function esc(t) {
  return String(t || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function normalizar(t) { return t.trim().toLocaleLowerCase("pt-BR"); }

function estaReservado(l) {
  return Boolean(l.reservado || l.reserva || l.status === "reservado" || l.status === "Reservado" || l.status === "emprestado");
}

function parseData(v) {
  if (v === null || v === undefined || v === "") return null;
  let d = null;
  if (typeof v === "number") d = new Date(v);
  else if (typeof v === "object" && typeof v.seconds === "number") d = new Date(v.seconds * 1000);
  else if (typeof v === "string") {
    const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (br) d = new Date(+br[3], +br[2] - 1, +br[1]);
    else if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    else d = new Date(v);
  }
  return d && !isNaN(d) ? d : null;
}
const diaInicial = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasEntre = (a, b) => Math.round((diaInicial(b) - diaInicial(a)) / MS_POR_DIA);
function adicionarDias(d, n) { const x = diaInicial(d); x.setDate(x.getDate() + n); return x; }
const formatarData = (d) => d.toLocaleDateString("pt-BR");

/* Mesma regra de situação da Consulta de Livros */
function obterSituacao(livro, hoje = new Date()) {
  const inicio = parseData(bruto(livro, ...CAMPOS.dataReserva));
  const devolucao = parseData(bruto(livro, ...CAMPOS.dataDevolucao));
  const devolvido = devolucao && (!inicio || devolucao >= inicio);
  if (devolvido || (!inicio && !estaReservado(livro))) return { ...SITUACOES.livre, detalhe: "" };
  if (!inicio) return { ...SITUACOES.emprestado, detalhe: "" };

  const limite = adicionarDias(inicio, PRAZO_DIAS);
  const dias = diasEntre(inicio, hoje);
  if (dias > PRAZO_DIAS) {
    const atraso = dias - PRAZO_DIAS;
    return { ...SITUACOES.atrasado, detalhe: `${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso` };
  }
  return { ...SITUACOES.emprestado, detalhe: `devolver até ${formatarData(limite)}` };
}
function textoSituacao(s) {
  const base = `${s.icone} ${s.rotulo}`;
  return s.detalhe ? `${base} · ${s.detalhe}` : base;
}

/* ---------- lista (apenas livros que estão emprestados/atrasados) ---------- */
function emprestados() {
  return livros.filter((l) => obterSituacao(l).chave !== "livre");
}

// etiqueta da situação + detalhe (prazo ou dias de atraso)
function htmlSituacao(s) {
  return `<span class="tag ${s.chave}">${esc(s.rotulo)}</span>` +
    (s.detalhe ? `<span class="situacao-detalhe ${s.chave}">${esc(s.detalhe)}</span>` : "");
}

function criarItemLivro(livro) {
  const s = obterSituacao(livro);
  const aluna = valor(livro, ...CAMPOS.aluna);
  const inicio = parseData(bruto(livro, ...CAMPOS.dataReserva));
  const tr = document.createElement("tr");
  if (s.chave === "atrasado") tr.className = "atrasado-linha";
  tr.innerHTML = `
    <td class="col-num">${esc(valor(livro, ...CAMPOS.codigo) || livro.id)}</td>
    <td><strong>${esc(valor(livro, ...CAMPOS.titulo))}</strong>
      <span class="situacao-detalhe">${esc(valor(livro, ...CAMPOS.autor))}</span></td>
    <td>${aluna ? esc(aluna) : '<span class="situacao-detalhe">não informada</span>'}</td>
    <td class="centro">${inicio ? formatarData(inicio) : "—"}</td>
    <td>${htmlSituacao(s)}</td>
    <td class="centro"><button class="btn btn-primaria btn-mini" type="button">
      <svg class="i"><use href="#i-devolver"/></svg>Devolver</button></td>`;
  tr.querySelector("button").onclick = () => abrirConfirmacao(livro);
  return tr;
}

// resumo no topo: quantos estão com as alunas e quantos atrasados
function resumir() {
  const lista = emprestados();
  const atrasados = lista.filter((l) => obterSituacao(l).chave === "atrasado").length;
  $("resumoEmprestimos").textContent = lista.length
    ? `${lista.length} livro(s) emprestado(s) • ${atrasados} atrasado(s)`
    : "nenhum livro emprestado";
}

function render(lista) {
  const total = emprestados().length;
  $("contador").textContent = lista.length + (lista.length === 1 ? " livro" : " livros") +
    (lista.length !== total ? " de " + total : "");
  $("lista").innerHTML = "";
  $("vazio").hidden = lista.length > 0;
  lista.forEach((l) => $("lista").appendChild(criarItemLivro(l)));
}

function filtrar() {
  const fc = normalizar($("filtroCodigo").value), ft = normalizar($("filtroTitulo").value);
  render(emprestados().filter((l) =>
    (valor(l, ...CAMPOS.codigo) || l.id).toLocaleLowerCase("pt-BR").includes(fc) &&
    (valor(l, ...CAMPOS.titulo) + " " + valor(l, ...CAMPOS.aluna)).toLocaleLowerCase("pt-BR").includes(ft)));
}

/* ---------- pop-up de confirmação ---------- */
function abrirConfirmacao(livro) {
  pendente = livro;
  const s = obterSituacao(livro);
  $("modalCodigo").textContent = valor(livro, ...CAMPOS.codigo) || livro.id || "—";
  $("modalTitulo").textContent = valor(livro, ...CAMPOS.titulo) || "—";
  $("modalAluna").textContent = valor(livro, ...CAMPOS.aluna) || "Nome da aluna não informado";
  $("modalStatus").innerHTML = htmlSituacao(s);
  $("modal").hidden = false;
}
function fecharModal() { pendente = null; $("modal").hidden = true; }

async function confirmarDevolucao() {
  if (!pendente) return;
  const livro = pendente;
  const btn = $("modalConfirmar");
  btn.disabled = true;
  const agora = Date.now();

  // Atualização atômica em vários caminhos (null remove o campo)
  const mudancas = {
    [`livros/${livro.id}/status`]: "disponivel",
    [`livros/${livro.id}/reservado`]: false,
    [`livros/${livro.id}/emprestimoId`]: "",
    [`livros/${livro.id}/dataDevolucao`]: agora,
    [`livros/${livro.id}/aluna`]: null,
    [`livros/${livro.id}/alunaCurso`]: null,
    [`livros/${livro.id}/alunaChamada`]: null
  };
  if (livro.emprestimoId) {
    mudancas[`emprestimos/${livro.emprestimoId}/status`] = "devolvido";
    mudancas[`emprestimos/${livro.emprestimoId}/dataDevolucao`] = agora;
  }

  try {
    await update(ref(db), mudancas);
    fecharModal();
    $("status").textContent = `Devolução registrada: "${valor(livro, ...CAMPOS.titulo)}" está livre.`;
  } catch (e) {
    console.error(e);
    const msg = String((e && (e.code || e.message)) || "").toUpperCase();
    alert(msg.includes("PERMISSION")
      ? "Sem permissão no banco de dados. Verifique as regras do Realtime Database e o login."
      : "Não foi possível registrar a devolução. Verifique a conexão e tente novamente.");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- carregamento em tempo real ---------- */
onValue(ref(db, "livros"), (snap) => {
  const dados = snap.val() || {};
  livros = Object.entries(dados).map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), "pt-BR", { numeric: true }));
  if ($("status").textContent === "Carregando livros...") $("status").textContent = "Livros carregados do banco de dados.";
  resumir();
  filtrar();
}, (e) => {
  console.error(e);
  $("status").textContent = "Não foi possível consultar o Firebase (" + (e.code || e.message) + ").";
  $("vazio").hidden = false;
  $("resumoEmprestimos").textContent = "não foi possível carregar";
});

/* ---------- eventos ---------- */
$("filtrar").onclick = filtrar;
$("filtroCodigo").onkeydown = (e) => { if (e.key === "Enter") filtrar(); };
$("filtroTitulo").onkeydown = (e) => { if (e.key === "Enter") filtrar(); };
// filtra enquanto digita
$("filtroCodigo").oninput = filtrar;
$("filtroTitulo").oninput = filtrar;
$("modalVoltar").onclick = fecharModal;
$("modalConfirmar").onclick = confirmarDevolucao;
