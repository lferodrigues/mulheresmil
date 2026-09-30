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
   2. Estado e referências do DOM
   --------------------------------------------------------- */
let livros = [];

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------
   3. Nomes alternativos dos campos no Firestore
   --------------------------------------------------------- */
const CAMPOS = {
  codigo: ["codigo", "numero", "numeroCodigo"],
  titulo: ["titulo", "title"],
  autor: ["autor", "autora", "autor(a)"],
  genero: ["genero", "categoria", "generoCategoria"],
  aluna: ["aluna", "nomeAluna", "alunaNome", "reservadoPara"]
};

/* ---------------------------------------------------------
   4. Funções utilitárias
   --------------------------------------------------------- */

// Retorna o primeiro campo existente (e não nulo) entre as chaves informadas
function valor(obj, ...chaves) {
  for (const chave of chaves) {
    if (obj[chave] !== undefined && obj[chave] !== null) {
      return String(obj[chave]);
    }
  }
  return "";
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

// Verifica se o livro está reservado
function estaReservado(livro) {
  return Boolean(
    livro.reservado ||
    livro.reserva ||
    livro.status === "reservado" ||
    livro.status === "Reservado"
  );
}

/* ---------------------------------------------------------
   5. Carregamento dos dados
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
   6. Renderização da lista
   --------------------------------------------------------- */
function criarItemLivro(livro) {
  const codigo = valor(livro, ...CAMPOS.codigo);
  const titulo = valor(livro, ...CAMPOS.titulo);
  const autor = valor(livro, ...CAMPOS.autor);

  const item = document.createElement("div");
  item.className = "livro-item";
  item.innerHTML = `
    <strong class="livro-codigo">${esc(codigo)}</strong>
    <span class="livro-info">
      <strong>${esc(titulo)}</strong>
      <small>${esc(autor)}</small>
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
   7. Filtro
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
   8. Modal de detalhes
   --------------------------------------------------------- */
function abrirDetalhes(livro) {
  const reservado = estaReservado(livro);
  const aluna = valor(livro, ...CAMPOS.aluna);

  $("modalCodigo").textContent = valor(livro, ...CAMPOS.codigo) || "—";
  $("modalTitulo").textContent = valor(livro, ...CAMPOS.titulo) || "—";
  $("modalAutor").textContent = valor(livro, ...CAMPOS.autor) || "—";
  $("modalGenero").textContent = valor(livro, ...CAMPOS.genero) || "—";

  $("modalStatus").textContent = reservado ? "Reservado" : "Disponível";
  $("modalStatus").className = "situacao" + (reservado ? " reservado" : "");

  $("modalAluna").textContent = aluna || "Nome da aluna não informado";
  $("reservaBox").hidden = !reservado;

  $("modal").hidden = false;
}

function fecharModal() {
  $("modal").hidden = true;
}

/* ---------------------------------------------------------
   9. Eventos
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
   10. Inicialização
   --------------------------------------------------------- */
iniciarEventos();
carregar();
