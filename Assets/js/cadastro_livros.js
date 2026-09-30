import { db } from "./firebase-config.js";
import {
  ref, get, set, update, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const $ = id => document.getElementById(id);
const livrosRef = ref(db, "livros");
let cache = {};
let pendente = null;

/* ---------- utilidades ---------- */

// O Realtime Database não aceita  . $ # [ ] /  nem espaços/controle em chaves.
function chave(codigo) {
  return String(codigo)
    .trim()
    .toUpperCase()
    .replace(/[.#$\[\]\/\s\u0000-\u001f\u007f]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function dados() {
  return {
    codigo: $("codigo").value.trim(),
    titulo: $("titulo").value.trim(),
    autor: $("autor").value.trim(),
    genero: $("genero").value.trim()
  };
}

function erro(e) {
  console.error(e);
  const msg = String(e && (e.code || e.message) || "").toUpperCase();
  if (msg.includes("PERMISSION")) {
    alert("Sem permissão para acessar o banco de dados. Verifique as regras do Realtime Database e o login.");
  } else {
    alert("Não foi possível concluir a operação. Verifique a conexão e tente novamente.");
  }
}

function fecharModal() { $("modal").hidden = true; }
function limpar() { $("formLivro").reset(); }

/* ---------- salvar ---------- */

async function salvar() {
  const d = dados();
  if (!d.codigo || !d.titulo || !d.autor || !d.genero) {
    alert("Preencha todos os campos.");
    return;
  }
  const id = chave(d.codigo);
  if (!id) {
    alert("Código inválido.");
    return;
  }

  let existe = false;
  try {
    existe = (await get(ref(db, "livros/" + id))).exists();
  } catch (e) {
    return erro(e);
  }

  pendente = { id, d, existe };

  $("modalIcon").textContent = existe ? "!" : "✓";
  $("modalTitulo").textContent = existe ? "Atualizar livro" : "Confirmar cadastro";
  $("modalTexto").textContent = existe
    ? "Já existe um livro com este código. Os dados serão atualizados (a situação do livro é mantida)."
    : "Confira as informações do livro e confirme se realmente deseja salvar.";
  $("modalCodigo").textContent = d.codigo;
  $("modalTituloLivro").textContent = d.titulo;
  $("modalAutor").textContent = d.autor;
  $("modalGenero").textContent = d.genero;
  $("modalData").hidden = false;
  $("modalConfirmar").textContent = existe ? "Confirmar e atualizar" : "Confirmar e salvar";
  $("modalConfirmar").onclick = confirmarSalvar;
  $("modal").hidden = false;
}

async function confirmarSalvar() {
  if (!pendente) return;
  const { id, d, existe } = pendente;
  const btn = $("modalConfirmar");
  btn.disabled = true;

  try {
    const base = {
      codigo: d.codigo,
      titulo: d.titulo,
      autor: d.autor,
      genero: d.genero,
      atualizadoEm: serverTimestamp()
    };

    if (existe) {
      // mantém status, reservado, emprestimoId e criadoEm
      await update(ref(db, "livros/" + id), base);
    } else {
      await set(ref(db, "livros/" + id), {
        ...base,
        status: "disponivel",
        reservado: false,
        emprestimoId: "",
        criadoEm: serverTimestamp()
      });
    }

    pendente = null;
    fecharModal();
    limpar();
  } catch (e) {
    erro(e);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- excluir (limpar formulário) ---------- */

function excluir() {
  const d = dados();
  if (!d.codigo && !d.titulo && !d.autor && !d.genero) {
    limpar();
    return;
  }
  $("modalIcon").textContent = "?";
  $("modalTitulo").textContent = "Confirmar exclusão";
  $("modalTexto").textContent = "Tem certeza de que deseja excluir e limpar todos os dados preenchidos?";
  $("modalData").hidden = true;
  $("modalConfirmar").textContent = "Sim, excluir";
  $("modalConfirmar").onclick = () => { fecharModal(); limpar(); };
  $("modal").hidden = false;
}

/* ---------- lista em tempo real ---------- */

function render() {
  const lista = Object.entries(cache)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) =>
      String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), "pt-BR", { numeric: true })
    );

  $("contador").textContent = lista.length;
  $("livros").hidden = !lista.length;
  $("lista").innerHTML = lista.map(x =>
    '<div data-id="' + esc(x.id) + '" style="cursor:pointer" title="Clique para editar">' +
      '<b class="codigo">' + esc(x.codigo || x.id) + '</b>' +
      '<span class="livro"><strong>' + esc(x.titulo) + '</strong>' +
      '<small>' + esc(x.autor) + ' • ' + esc(x.genero) + '</small></span>' +
    '</div>'
  ).join("");
}

// clicar num livro da lista carrega os dados no formulário para editar
$("lista").addEventListener("click", e => {
  const item = e.target.closest("div[data-id]");
  if (!item) return;
  const l = cache[item.dataset.id];
  if (!l) return;
  $("codigo").value = l.codigo || item.dataset.id;
  $("titulo").value = l.titulo || "";
  $("autor").value = l.autor || "";
  $("genero").value = l.genero || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

onValue(livrosRef, snap => {
  cache = snap.val() || {};
  render();
}, erro);

/* ---------- migração única do localStorage ---------- */

async function migrar() {
  if (localStorage.getItem("mm_livros_migrados") || sessionStorage.getItem("mm_livros_migrar_recusado")) return;

  let antigos = [];
  try { antigos = JSON.parse(localStorage.getItem("mm_biblioteca_livros") || "[]"); } catch (e) {}
  antigos = antigos.filter(x => x && x.codigo && chave(x.codigo));
  if (!antigos.length) return;

  if (!confirm("Encontrei " + antigos.length + " livro(s) salvos apenas neste navegador. Deseja enviá-los para o banco de dados?")) {
    sessionStorage.setItem("mm_livros_migrar_recusado", "1");
    return;
  }

  try {
    const existentes = (await get(livrosRef)).val() || {};
    const envio = {};
    antigos.forEach(x => {
      const id = chave(x.codigo);
      if (existentes[id] || envio[id]) return; // não sobrescreve o que já está no banco
      envio[id] = {
        codigo: String(x.codigo).trim(),
        titulo: x.titulo || "",
        autor: x.autor || "",
        genero: x.genero || "",
        status: "disponivel",
        reservado: false,
        emprestimoId: "",
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      };
    });
    if (Object.keys(envio).length) await update(livrosRef, envio);
    localStorage.setItem("mm_livros_migrados", "1");
    alert("Migração concluída: " + Object.keys(envio).length + " livro(s) enviados.");
  } catch (e) {
    erro(e);
  }
}

/* ---------- eventos ---------- */

$("formLivro").onsubmit = e => { e.preventDefault(); salvar(); };
$("excluir").onclick = excluir;
$("modalVoltar").onclick = fecharModal;

migrar();
