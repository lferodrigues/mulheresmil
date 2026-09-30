/* =========================================================
   Cadastro de Livros — Biblioteca Itinerante (Mulheres Mil)
   ========================================================= */

/* ---------------------------------------------------------
   1. Constantes e atalhos
   --------------------------------------------------------- */
const STORAGE_KEY = "mm_biblioteca_livros";

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------
   2. Utilitários
   --------------------------------------------------------- */

// Escapa caracteres HTML para evitar injeção de código
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// Lê os valores do formulário
function dados() {
  return {
    codigo: $("codigo").value.trim(),
    titulo: $("titulo").value.trim(),
    autor: $("autor").value.trim(),
    genero: $("genero").value.trim()
  };
}

// Verifica se todos os campos do formulário estão vazios
function formularioVazio() {
  const d = dados();
  return !d.codigo && !d.titulo && !d.autor && !d.genero;
}

function limpar() {
  $("formLivro").reset();
}

/* ---------------------------------------------------------
   3. Armazenamento (localStorage)
   --------------------------------------------------------- */
function get() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function gravar(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/* ---------------------------------------------------------
   4. Modal
   --------------------------------------------------------- */
function abrirModal() {
  $("modal").hidden = false;
}

function fecharModal() {
  $("modal").hidden = true;
}

/* ---------------------------------------------------------
   5. Salvar livro
   --------------------------------------------------------- */

// Valida os campos e abre o modal de confirmação
function salvar() {
  const d = dados();

  if (!d.codigo || !d.titulo || !d.autor || !d.genero) {
    alert("Preencha todos os campos.");
    return;
  }

  $("modalIcon").textContent = "✓";
  $("modalTitulo").textContent = "Confirmar cadastro";
  $("modalTexto").textContent = "Confira as informações do livro e confirme se realmente deseja salvar.";

  $("modalCodigo").textContent = d.codigo;
  $("modalTituloLivro").textContent = d.titulo;
  $("modalAutor").textContent = d.autor;
  $("modalGenero").textContent = d.genero;
  $("modalData").hidden = false;

  $("modalConfirmar").textContent = "Confirmar e salvar";
  $("modalConfirmar").onclick = confirmarSalvar;

  abrirModal();
}

// Grava o livro (atualiza se o código já existir, senão adiciona)
function confirmarSalvar() {
  const d = dados();
  const lista = get();

  const indice = lista.findIndex(
    (livro) => livro.codigo.toLowerCase() === d.codigo.toLowerCase()
  );

  if (indice >= 0) {
    lista[indice] = d;
  } else {
    lista.push(d);
  }

  gravar(lista);
  fecharModal();
  limpar();
  render();
}

/* ---------------------------------------------------------
   6. Excluir (limpar formulário)
   --------------------------------------------------------- */
function excluir() {
  if (formularioVazio()) {
    limpar();
    return;
  }

  $("modalIcon").textContent = "?";
  $("modalTitulo").textContent = "Confirmar exclusão";
  $("modalTexto").textContent = "Tem certeza de que deseja excluir e limpar todos os dados preenchidos?";
  $("modalData").hidden = true;

  $("modalConfirmar").textContent = "Sim, excluir";
  $("modalConfirmar").onclick = () => {
    fecharModal();
    limpar();
  };

  abrirModal();
}

/* ---------------------------------------------------------
   7. Renderização da lista de livros cadastrados
   --------------------------------------------------------- */
function render() {
  const lista = get();

  $("contador").textContent = lista.length;
  $("livros").hidden = !lista.length;

  $("lista").innerHTML = lista.map((livro) => `
    <div>
      <b class="codigo">${esc(livro.codigo)}</b>
      <span class="livro">
        <strong>${esc(livro.titulo)}</strong>
        <small>${esc(livro.autor)} • ${esc(livro.genero)}</small>
      </span>
    </div>
  `).join("");
}

/* ---------------------------------------------------------
   8. Eventos
   --------------------------------------------------------- */
function iniciarEventos() {
  $("formLivro").onsubmit = (e) => {
    e.preventDefault();
    salvar();
  };

  $("excluir").onclick = excluir;
  $("modalVoltar").onclick = fecharModal;
}

/* ---------------------------------------------------------
   9. Inicialização
   --------------------------------------------------------- */
iniciarEventos();
render();
