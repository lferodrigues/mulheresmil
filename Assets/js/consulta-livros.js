/* =========================================================
   Consulta de Livros — Biblioteca Itinerante (Mulheres Mil)
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ---------------------------------------------------------
   1. Configuração do Firebase
   --------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyA2Kz1hwQM8HplqtIPM6GMBSX-aroExg0w",
  authDomain: "biblioteca-virtual-8db41.firebaseapp.com",
  projectId: "biblioteca-virtual-8db41",
  storageBucket: "biblioteca-virtual-8db41.firebasestorage.app",
  messagingSenderId: "247188034497",
  appId: "1:247188034497:web:29d31ef65693d5d85e5540",
  measurementId: "G-6F9T86KGZ3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------------------------------------------------
   2. Estado, constantes e referências do DOM
   --------------------------------------------------------- */
let livros = [];

const PRAZO_DIAS = 15;           // prazo contado a partir da data da reserva
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------
   3. Nomes alternativos dos campos no Firestore
   --------------------------------------------------------- */
const CAMPOS = {
  codigo: ["codigo", "numero", "numeroCodigo"],
  titulo: ["titulo", "title"],
  autor: ["autor", "autora", "autor(a)"],
  genero: ["genero", "categoria", "generoCategoria"],
  aluna: ["aluna", "nomeAluna", "alunaNome", "reservadoPara"],
  dataReserva: ["dataReserva", "data_reserva", "reservadoEm", "dataEmprestimo", "dataInicio"],
  dataDevolucao: ["dataDevolucao", "data_devolucao", "devolvidoEm", "dataDevolvido"]
};

/* ---------------------------------------------------------
   4. Situações possíveis do livro
   --------------------------------------------------------- */
const SITUACOES = {
  livre:      { chave: "livre",      icone: "🟢", rotulo: "Livre" },
  emprestado: { chave: "emprestado", icone: "🟡", rotulo: "Emprestado" },
  atrasado:   { chave: "atrasado",   icone: "🔴", rotulo: "Atrasado" }
};

/* ---------------------------------------------------------
   5. Funções utilitárias
   --------------------------------------------------------- */

// Retorna o primeiro campo existente (e não nulo) como texto
function valor(obj, ...chaves) {
  for (const chave of chaves) {
    if (obj[chave] !== undefined && obj[chave] !== null) {
      return String(obj[chave]);
    }
  }
  return "";
}

// Retorna o primeiro campo existente sem converter (útil para datas)
function bruto(obj, ...chaves) {
  for (const chave of chaves) {
    if (obj[chave] !== undefined && obj[chave] !== null && obj[chave] !== "") {
      return obj[chave];
    }
  }
  return null;
}

// Escapa caracteres HTML para evitar injeção de código
function esc(texto) {
  return String(texto || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// Normaliza texto para comparação (minúsculas, padrão pt-BR)
function normalizar(texto) {
  return texto.trim().toLocaleLowerCase("pt-BR");
}

// Verifica se o livro está marcado como reservado
function estaReservado(livro) {
  return Boolean(
    livro.reservado ||
    livro.reserva ||
    livro.status === "reservado" ||
    livro.status === "Reservado"
  );
}

/* ---------------------------------------------------------
   6. Datas
   --------------------------------------------------------- */

// Converte vários formatos em Date: Timestamp do Firestore,
// Date, número, "dd/mm/aaaa" e "aaaa-mm-dd". Retorna null se inválido.
function parseData(v) {
  if (v === null || v === undefined || v === "") return null;

  let data = null;

  if (typeof v.toDate === "function") {
    data = v.toDate();
  } else if (v instanceof Date) {
    data = v;
  } else if (typeof v === "object" && typeof v.seconds === "number") {
    data = new Date(v.seconds * 1000);
  } else if (typeof v === "number") {
    data = new Date(v);
  } else if (typeof v === "string") {
    const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (br) data = new Date(+br[3], +br[2] - 1, +br[1]);
    else if (iso) data = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    else data = new Date(v);
  }

  return data && !isNaN(data) ? data : null;
}

function diaInicial(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function diasEntre(inicio, fim) {
  return Math.round((diaInicial(fim) - diaInicial(inicio)) / MS_POR_DIA);
}

function adicionarDias(data, dias) {
  const nova = diaInicial(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function formatarData(data) {
  return data.toLocaleDateString("pt-BR");
}

/* ---------------------------------------------------------
   7. Situação do livro (Livre / Emprestado / Atrasado)
   --------------------------------------------------------- */

// Regras:
//  🟢 Livre:      há data de devolução (posterior à reserva) ou o livro não está reservado
//  🟡 Emprestado: reservado e dentro do prazo de 15 dias
//  🔴 Atrasado:   passou de 15 dias desde a data da reserva
function obterSituacao(livro, hoje = new Date()) {
  const inicio = parseData(bruto(livro, ...CAMPOS.dataReserva));
  const devolucao = parseData(bruto(livro, ...CAMPOS.dataDevolucao));

  const devolvido = devolucao && (!inicio || devolucao >= inicio);
  if (devolvido || (!inicio && !estaReservado(livro))) {
    return { ...SITUACOES.livre, detalhe: "" };
  }

  // Reservado, mas sem data de reserva: não dá para calcular o prazo
  if (!inicio) {
    return { ...SITUACOES.emprestado, detalhe: "" };
  }

  const limite = adicionarDias(inicio, PRAZO_DIAS);
  const diasDecorridos = diasEntre(inicio, hoje);

  if (diasDecorridos > PRAZO_DIAS) {
    const atraso = diasDecorridos - PRAZO_DIAS;
    return {
      ...SITUACOES.atrasado,
      detalhe: `${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso`
    };
  }

  return {
    ...SITUACOES.emprestado,
    detalhe: `devolver até ${formatarData(limite)}`
  };
}

function textoSituacao(situacao) {
  const base = `${situacao.icone} ${situacao.rotulo}`;
  return situacao.detalhe ? `${base} · ${situacao.detalhe}` : base;
}

/* ---------------------------------------------------------
   8. Carregamento dos dados
   --------------------------------------------------------- */
async function carregar() {
  try {
    $("status").textContent = "Carregando livros...";

    const snapshot = await getDocs(collection(db, "livros"));
    livros = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    render(livros);
    $("status").textContent = "Livros carregados do Firebase.";
  } catch (erro) {
    console.error(erro);
    $("status").textContent = "Não foi possível consultar o Firebase.";
    $("vazio").hidden = false;
  }
}

/* ---------------------------------------------------------
   9. Renderização da lista
   --------------------------------------------------------- */
function criarItemLivro(livro) {
  const codigo = valor(livro, ...CAMPOS.codigo);
  const titulo = valor(livro, ...CAMPOS.titulo);
  const autor = valor(livro, ...CAMPOS.autor);
  const situacao = obterSituacao(livro);

  const item = document.createElement("div");
  item.className = "livro-item";
  item.innerHTML = `
    <strong class="livro-codigo">${esc(codigo)}</strong>
    <span class="livro-info">
      <strong>${esc(titulo)}</strong>
      <small>${esc(autor)}</small>
      <small class="livro-status livro-status-${situacao.chave}">${esc(textoSituacao(situacao))}</small>
    </span>
    <button class="expandir" type="button">Expandir</button>
  `;

  item.querySelector("button").onclick = () => abrirDetalhes(livro);
  return item;
}

function render(lista) {
  $("contador").textContent = lista.length + (lista.length === 1 ? " livro" : " livros");
  $("lista").innerHTML = "";
  $("vazio").hidden = lista.length > 0;

  lista.forEach((livro) => $("lista").appendChild(criarItemLivro(livro)));
}

/* ---------------------------------------------------------
   10. Filtro
   --------------------------------------------------------- */
function filtrar() {
  const filtroCodigo = normalizar($("filtroCodigo").value);
  const filtroTitulo = normalizar($("filtroTitulo").value);

  const resultado = livros.filter((livro) => {
    const codigo = valor(livro, ...CAMPOS.codigo).toLocaleLowerCase("pt-BR");
    const titulo = valor(livro, ...CAMPOS.titulo).toLocaleLowerCase("pt-BR");
    return codigo.includes(filtroCodigo) && titulo.includes(filtroTitulo);
  });

  render(resultado);
}

/* ---------------------------------------------------------
   11. Modal de detalhes
   --------------------------------------------------------- */
function abrirDetalhes(livro) {
  const situacao = obterSituacao(livro);
  const livre = situacao.chave === "livre";
  const aluna = valor(livro, ...CAMPOS.aluna);

  $("modalCodigo").textContent = valor(livro, ...CAMPOS.codigo) || "—";
  $("modalTitulo").textContent = valor(livro, ...CAMPOS.titulo) || "—";
  $("modalAutor").textContent = valor(livro, ...CAMPOS.autor) || "—";
  $("modalGenero").textContent = valor(livro, ...CAMPOS.genero) || "—";

  $("modalStatus").textContent = textoSituacao(situacao);
  $("modalStatus").className = "situacao" + (livre ? "" : " reservado");

  $("modalAluna").textContent = aluna || "Nome da aluna não informado";
  $("reservaBox").hidden = livre;

  $("modal").hidden = false;
}

function fecharModal() {
  $("modal").hidden = true;
}

/* ---------------------------------------------------------
   12. Eventos
   --------------------------------------------------------- */
function iniciarEventos() {
  $("filtrar").onclick = filtrar;

  const aoApertarEnter = (e) => {
    if (e.key === "Enter") filtrar();
  };
  $("filtroCodigo").onkeydown = aoApertarEnter;
  $("filtroTitulo").onkeydown = aoApertarEnter;

  $("modalFechar").onclick = fecharModal;
}

/* ---------------------------------------------------------
   13. Inicialização
   --------------------------------------------------------- */
iniciarEventos();
carregar();
