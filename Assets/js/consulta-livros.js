/* Consulta de Livros — Biblioteca Itinerante (Realtime Database) */
import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

let livros = [];
const PRAZO_DIAS = 15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);

const CAMPOS = {
  codigo: ["codigo", "numero", "numeroCodigo"],
  titulo: ["titulo", "title"],
  autor: ["autor", "autora", "autor(a)"],
  genero: ["genero", "categoria", "generoCategoria"],
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
  if (typeof v === "number") d = new Date(v);            // serverTimestamp do RTDB = milissegundos
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

async function carregar() {
  try {
    $("status").textContent = "Carregando livros...";
    const snap = await get(ref(db, "livros"));
    const dados = snap.val() || {};
    livros = Object.entries(dados).map(([id, l]) => ({ id, ...l }))
      .sort((a, b) => String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), "pt-BR", { numeric: true }));
    resumirAcervo();
    filtrar(); // respeita o que já estiver digitado nos filtros
    $("status").textContent = "Livros carregados do banco de dados.";
  } catch (e) {
    console.error(e);
    $("status").textContent = "Não foi possível consultar o Firebase (" + (e.code || e.message) + ").";
    $("vazio").hidden = false;
    $("resumoAcervo").textContent = "não foi possível carregar";
  }
}

function criarItemLivro(livro) {
  const s = obterSituacao(livro);
  const tr = document.createElement("tr");
  tr.title = "Clique para ver os detalhes";
  tr.innerHTML = `
    <td class="col-num">${esc(valor(livro, ...CAMPOS.codigo) || livro.id)}</td>
    <td><strong>${esc(valor(livro, ...CAMPOS.titulo))}</strong></td>
    <td>${esc(valor(livro, ...CAMPOS.autor))}</td>
    <td>${esc(valor(livro, ...CAMPOS.genero))}</td>
    <td><span class="tag ${s.chave}">${esc(s.rotulo)}</span>
      ${s.detalhe ? `<span class="situacao-detalhe ${s.chave}">${esc(s.detalhe)}</span>` : ""}</td>
    <td class="centro"><button class="btn btn-contorno btn-mini" type="button">
      <svg class="i"><use href="#i-olho"/></svg>Expandir</button></td>`;
  tr.onclick = () => abrirDetalhes(livro);
  return tr;
}

function render(lista) {
  $("contador").textContent = lista.length + (lista.length === 1 ? " livro" : " livros") +
    (lista.length !== livros.length ? " de " + livros.length : "");
  $("lista").innerHTML = "";
  $("vazio").hidden = lista.length > 0;
  lista.forEach((l) => $("lista").appendChild(criarItemLivro(l)));
}

// resumo do acervo no topo da página
function resumirAcervo() {
  const conta = { livre: 0, emprestado: 0, atrasado: 0 };
  livros.forEach((l) => { conta[obterSituacao(l).chave]++; });
  $("resumoAcervo").textContent = livros.length
    ? `${livros.length} livro(s) • ${conta.livre} livre(s) • ${conta.emprestado} emprestado(s) • ${conta.atrasado} atrasado(s)`
    : "nenhum livro cadastrado";
}

function filtrar() {
  const fc = normalizar($("filtroCodigo").value), ft = normalizar($("filtroTitulo").value);
  render(livros.filter((l) =>
    (valor(l, ...CAMPOS.codigo) || l.id).toLocaleLowerCase("pt-BR").includes(fc) &&
    valor(l, ...CAMPOS.titulo).toLocaleLowerCase("pt-BR").includes(ft)));
}

function abrirDetalhes(livro) {
  const s = obterSituacao(livro);
  const livre = s.chave === "livre";
  $("modalCodigo").textContent = valor(livro, ...CAMPOS.codigo) || livro.id || "—";
  $("modalTitulo").textContent = valor(livro, ...CAMPOS.titulo) || "—";
  $("modalAutor").textContent = valor(livro, ...CAMPOS.autor) || "—";
  $("modalGenero").textContent = valor(livro, ...CAMPOS.genero) || "—";
  $("modalStatus").innerHTML = `<span class="tag ${s.chave}">${esc(s.rotulo)}</span>` +
    (s.detalhe ? `<span class="situacao-detalhe ${s.chave}">${esc(s.detalhe)}</span>` : "");
  $("modalAluna").textContent = valor(livro, ...CAMPOS.aluna) || "Nome da aluna não informado";
  $("reservaBox").hidden = livre;
  $("modal").hidden = false;
}

$("filtrar").onclick = filtrar;
$("filtroCodigo").onkeydown = (e) => { if (e.key === "Enter") filtrar(); };
$("filtroTitulo").onkeydown = (e) => { if (e.key === "Enter") filtrar(); };
// filtra enquanto digita
$("filtroCodigo").oninput = filtrar;
$("filtroTitulo").oninput = filtrar;
$("modalFechar").onclick = () => { $("modal").hidden = true; };

carregar();
