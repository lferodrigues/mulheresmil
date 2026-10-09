import { db } from "./firebase-config.js";
import {
  ref, get, set, update, remove, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { lerCatalogoPdf, normaliza } from "./importar_livros_pdf.js";

const $ = id => document.getElementById(id);
const livrosRef = ref(db, "livros");
let cache = {};
let pendente = null;
let paraRemover = null;

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

function fecharModal() { pendente = null; paraRemover = null; $("modal").hidden = true; }
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

  paraRemover = null;
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

/* ---------- limpar formulário ---------- */

function excluir() {
  const d = dados();
  if (!d.codigo && !d.titulo && !d.autor && !d.genero) {
    limpar();
    return;
  }
  pendente = null; paraRemover = null;
  $("modalIcon").textContent = "?";
  $("modalTitulo").textContent = "Limpar formulário";
  $("modalTexto").textContent = "Tem certeza de que deseja limpar todos os dados preenchidos?";
  $("modalData").hidden = true;
  $("modalConfirmar").textContent = "Sim, limpar";
  $("modalConfirmar").onclick = () => { fecharModal(); limpar(); };
  $("modal").hidden = false;
}

/* ---------- remover livro cadastrado ---------- */

function livroEmprestado(l) {
  return Boolean(l && (l.reservado || l.status === "emprestado" || l.status === "reservado"));
}

function pedirRemocao(id) {
  const l = cache[id];
  if (!l) return;

  // Não permite remover livro que está com uma aluna
  if (livroEmprestado(l)) {
    alert("Este livro está emprestado" + (l.aluna ? " para " + l.aluna : "") +
      ". Registre a devolução em 'Devolução de Livros' antes de removê-lo do acervo.");
    return;
  }

  pendente = null;
  paraRemover = { id, ...l };
  $("modalIcon").textContent = "🗑️";
  $("modalTitulo").textContent = "Remover livro";
  $("modalTexto").textContent = "Deseja realmente remover este livro do acervo? Esta ação não pode ser desfeita.";
  $("modalCodigo").textContent = l.codigo || id;
  $("modalTituloLivro").textContent = l.titulo || "—";
  $("modalAutor").textContent = l.autor || "—";
  $("modalGenero").textContent = l.genero || "—";
  $("modalData").hidden = false;
  $("modalConfirmar").textContent = "Sim, remover";
  $("modalConfirmar").onclick = confirmarRemocao;
  $("modal").hidden = false;
}

async function confirmarRemocao() {
  if (!paraRemover) return;
  const { id } = paraRemover;
  const btn = $("modalConfirmar");
  btn.disabled = true;

  try {
    // Confere o estado mais recente no banco antes de apagar
    const atual = (await get(ref(db, "livros/" + id))).val();
    if (livroEmprestado(atual)) {
      fecharModal();
      alert("Este livro acabou de ser emprestado. Registre a devolução antes de removê-lo.");
      return;
    }

    await remove(ref(db, "livros/" + id));

    // Se o livro removido estava aberto no formulário, limpa o formulário
    if (chave($("codigo").value) === id) limpar();
    fecharModal();
  } catch (e) {
    erro(e);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- lista em tempo real ---------- */

function render() {
  const lista = Object.entries(cache)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) =>
      String(a.codigo || a.id).localeCompare(String(b.codigo || b.id), "pt-BR", { numeric: true })
    );

  const total = lista.length;
  const emprestados = lista.filter(livroEmprestado).length;
  $("totalAcervo").textContent = total
    ? total + " livro(s) • " + (total - emprestados) + " livre(s) • " + emprestados + " emprestado(s)"
    : "nenhum livro cadastrado";

  // filtro da tabela (código, título ou autor)
  const q = normaliza($("filtroLivros").value);
  const visiveis = q
    ? lista.filter(x => normaliza([x.codigo || x.id, x.titulo, x.autor].join(" ")).includes(q))
    : lista;

  $("contador").textContent = q ? visiveis.length + " de " + total : total;

  if (!visiveis.length) {
    $("lista").innerHTML = '<tr><td colspan="6" class="vazio">' +
      (total ? "Nenhum livro encontrado para esta pesquisa." : "Nenhum livro cadastrado ainda.") + "</td></tr>";
    return;
  }

  $("lista").innerHTML = visiveis.map(x => {
    const emp = livroEmprestado(x);
    return '<tr data-id="' + esc(x.id) + '" title="Clique para editar">' +
      '<td class="col-num">' + esc(x.codigo || x.id) + "</td>" +
      "<td><strong>" + esc(x.titulo) + "</strong></td>" +
      "<td>" + esc(x.autor) + "</td>" +
      "<td>" + esc(x.genero) + "</td>" +
      '<td class="centro"><span class="tag ' + (emp ? "emprestado" : "livre") + '">' +
        (emp ? "Emprestado" : "Livre") + "</span></td>" +
      '<td class="centro"><button type="button" class="btn btn-perigo btn-mini remover-livro" data-id="' + esc(x.id) + '">' +
        '<svg class="i"><use href="#i-lixo"/></svg>Remover</button></td>' +
    "</tr>";
  }).join("");
}

$("filtroLivros").addEventListener("input", render);

// clicar em Remover abre a confirmação; clicar no resto da linha carrega os dados no formulário para editar
$("lista").addEventListener("click", e => {
  const botao = e.target.closest(".remover-livro");
  if (botao) {
    e.stopPropagation();
    pedirRemocao(botao.dataset.id);
    return;
  }
  const item = e.target.closest("tr[data-id]");
  if (!item) return;
  const l = cache[item.dataset.id];
  if (!l) return;
  abrirAba("cadastro");
  $("codigo").value = l.codigo || item.dataset.id;
  $("titulo").value = l.titulo || "";
  $("autor").value = l.autor || "";
  $("genero").value = l.genero || "";
  $("tab-cadastro").scrollIntoView({ behavior: "smooth", block: "start" });
  $("titulo").focus({ preventScroll: true });
});

onValue(livrosRef, snap => {
  cache = snap.val() || {};
  render();
  if (importados.length) renderImport(); // atualiza a prévia da importação, se aberta
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

/* ---------- importar catálogo em PDF ---------- */

// cada item: { id, numero, titulo, autor, genero, situacao, conferir, marcado, banco }
// situacao: "nova" | "diferente" | "igual" | "repetida"
let importados = [];
let nomeArquivo = "";

const ROTULOS = {
  nova: "Nova",
  diferente: "Dados diferentes",
  igual: "Já cadastrado",
  repetida: "Nº repetido no PDF"
};

function statusImport(texto, tipo = "") {
  $("statusImport").textContent = texto;
  $("statusImport").className = "status-import" + (tipo ? " " + tipo : "");
}

function mesmoLivro(a, b) {
  return ["titulo", "autor", "genero"].every(k => normaliza(a[k]) === normaliza(b[k]));
}

// Compara cada livro do PDF com o que já existe no banco
function classificar() {
  const vistos = new Set();
  importados.forEach(l => {
    const banco = cache[l.id];
    l.banco = banco || null;
    if (vistos.has(l.id)) l.situacao = "repetida";
    else if (!banco) l.situacao = "nova";
    else l.situacao = mesmoLivro(l, banco) ? "igual" : "diferente";
    vistos.add(l.id);
    if (l.marcado === undefined) l.marcado = l.situacao === "nova" || l.situacao === "diferente";
    if (l.situacao === "igual" || l.situacao === "repetida") l.marcado = false;
  });
}

function renderImport() {
  if (!importados.length) { $("previa").hidden = true; return; }
  classificar();

  $("arquivoNome").textContent = nomeArquivo + " — " + importados.length + " livro(s) lidos";
  $("listaImport").innerHTML = importados.map((l, i) => {
    const bloqueado = l.situacao === "igual" || l.situacao === "repetida";
    const detalhe = l.situacao === "diferente"
      ? '<span class="detalhe">No banco: ' + esc(l.banco.titulo || "—") + " • " + esc(l.banco.autor || "—") +
        " • " + esc(l.banco.genero || "—") + "</span>"
      : "";
    return '<tr data-i="' + i + '"' + (bloqueado ? ' class="bloqueada"' : "") + ">" +
        '<td class="col-check"><input type="checkbox" data-i="' + i + '" aria-label="Importar este livro"' +
          (l.marcado ? " checked" : "") + (bloqueado ? " disabled" : "") + "></td>" +
        '<td class="col-num">' + esc(l.numero) + "</td>" +
        "<td><strong>" + esc(l.titulo) + "</strong>" + detalhe + "</td>" +
        "<td>" + esc(l.autor || "—") + "</td>" +
        "<td>" + esc(l.genero || "—") + "</td>" +
        '<td class="centro"><span class="tag ' + l.situacao + '">' + ROTULOS[l.situacao] + "</span>" +
          (l.conferir ? '<span class="tag conferir">Conferir</span>' : "") + "</td>" +
      "</tr>";
  }).join("");

  const conta = s => importados.filter(l => l.situacao === s).length;
  const marcados = importados.filter(l => l.marcado).length;
  const conferir = importados.filter(l => l.conferir).length;
  $("resumoImport").innerHTML =
    '<span class="nova">' + conta("nova") + " nova(s)</span>" +
    '<span class="diferente">' + conta("diferente") + " para atualizar</span>" +
    '<span class="igual">' + conta("igual") + " já cadastrada(s)</span>" +
    (conta("repetida") ? '<span class="repetida">' + conta("repetida") + " repetida(s)</span>" : "") +
    (conferir ? '<span class="conferir">' + conferir + " para conferir</span>" : "");

  const marcaveis = importados.filter(l => l.situacao === "nova" || l.situacao === "diferente");
  $("marcarTodos").checked = marcaveis.length > 0 && marcaveis.every(l => l.marcado);
  $("marcarTodos").disabled = !marcaveis.length;
  $("salvarImport").disabled = !marcados;
  $("salvarImport").innerHTML = '<svg class="i"><use href="#i-salvar"/></svg>' +
    (marcados ? "Salvar " + marcados + " livro(s) no banco" : "Nada selecionado");
  $("previa").hidden = false;
}

async function receberArquivo(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    statusImport("Escolha um arquivo .pdf.", "erro");
    return;
  }
  importados = [];
  nomeArquivo = file.name;
  $("previa").hidden = true;
  statusImport("Lendo o PDF…");

  try {
    const r = await lerCatalogoPdf(await file.arrayBuffer());
    if (r.erro) { statusImport(r.erro, "erro"); return; }

    importados = r.livros
      .map(l => ({
        id: chave(l.numero),
        numero: l.numero,
        titulo: l.titulo.slice(0, 150),
        autor: l.autor.slice(0, 120),
        genero: l.genero.slice(0, 80),
        conferir: /conferir/i.test(l.titulo + " " + l.autor + " " + l.genero)
      }))
      .filter(l => l.id);

    statusImport(importados.length + " livro(s) encontrados. Confira a lista e salve.", "ok");
    renderImport();
  } catch (e) {
    console.error(e);
    statusImport("Não foi possível ler este PDF.", "erro");
  }
}

function cancelarImport() {
  importados = [];
  nomeArquivo = "";
  $("arquivoPdf").value = "";
  $("previa").hidden = true;
  statusImport("");
}

// abas: "cadastro" (formulário) ou "importar" (PDF)
function abrirAba(nome) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    const ativa = b.dataset.tab === nome;
    b.classList.toggle("active", ativa);
    b.setAttribute("aria-selected", String(ativa));
  });
  $("tab-cadastro").hidden = nome !== "cadastro";
  $("tab-importar").hidden = nome !== "importar";
}

function pedirImportacao() {
  const sel = importados.filter(l => l.marcado);
  if (!sel.length) return;
  const novas = sel.filter(l => l.situacao === "nova").length;
  const atualizar = sel.length - novas;
  const conferir = sel.filter(l => l.conferir).length;

  $("modalImportResumo").innerHTML =
    "<div><span>Arquivo</span><strong>" + esc(nomeArquivo) + "</strong></div>" +
    "<div><span>Livros novos</span><strong>" + novas + "</strong></div>" +
    "<div><span>Livros que serão atualizados</span><strong>" + atualizar + "</strong></div>" +
    (conferir ? "<div><span>Marcados como “conferir”</span><strong>" + conferir +
      " (verifique no exemplar depois)</strong></div>" : "");
  $("modalImport").hidden = false;
}

async function confirmarImportacao() {
  const sel = importados.filter(l => l.marcado);
  if (!sel.length) return;
  const btn = $("modalImportConfirmar");
  btn.disabled = true;
  btn.textContent = "Salvando…";

  try {
    // confere o banco no momento de salvar (alguém pode ter cadastrado enquanto isso)
    const atual = (await get(livrosRef)).val() || {};
    const envio = {};
    let novos = 0, atualizados = 0;

    sel.forEach(l => {
      const base = {
        codigo: l.numero,
        titulo: l.titulo,
        autor: l.autor,
        genero: l.genero
      };
      if (atual[l.id]) {
        // livro já existe: atualiza só os dados, mantém status, reserva e criadoEm
        Object.entries(base).forEach(([k, v]) => { envio[l.id + "/" + k] = v; });
        envio[l.id + "/atualizadoEm"] = serverTimestamp();
        atualizados++;
      } else {
        envio[l.id] = {
          ...base,
          status: "disponivel",
          reservado: false,
          emprestimoId: "",
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        };
        novos++;
      }
    });

    await update(livrosRef, envio);
    $("modalImport").hidden = true;
    cancelarImport();
    statusImport("Importação concluída: " + novos + " livro(s) novos e " + atualizados + " atualizado(s).", "ok");
  } catch (e) {
    erro(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar e salvar";
  }
}

// eventos da importação
$("abrirImportacao").onclick = () => {
  abrirAba("importar");
  $("tab-importar").scrollIntoView({ behavior: "smooth", block: "start" });
};
document.querySelectorAll(".tab-btn").forEach(b => { b.onclick = () => abrirAba(b.dataset.tab); });
$("arquivoPdf").onchange = e => receberArquivo(e.target.files[0]);
$("cancelarImport").onclick = cancelarImport;
$("salvarImport").onclick = pedirImportacao;
$("modalImportVoltar").onclick = () => { $("modalImport").hidden = true; };
$("modalImportConfirmar").onclick = confirmarImportacao;

$("listaImport").addEventListener("change", e => {
  const cb = e.target.closest("input[data-i]");
  if (!cb) return;
  importados[+cb.dataset.i].marcado = cb.checked;
  renderImport();
});

// clicar em qualquer parte da linha também marca/desmarca
$("listaImport").addEventListener("click", e => {
  if (e.target.closest("input")) return;
  const tr = e.target.closest("tr[data-i]");
  const l = tr && importados[+tr.dataset.i];
  if (!l || l.situacao === "igual" || l.situacao === "repetida") return;
  l.marcado = !l.marcado;
  renderImport();
});

$("marcarTodos").onchange = e => {
  importados.forEach(l => {
    if (l.situacao === "nova" || l.situacao === "diferente") l.marcado = e.target.checked;
  });
  renderImport();
};

// arrastar e soltar
const drop = $("drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.add("sobre");
}));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.remove("sobre");
}));
drop.addEventListener("drop", e => receberArquivo(e.dataTransfer.files[0]));

/* ---------- eventos ---------- */

$("formLivro").onsubmit = e => { e.preventDefault(); salvar(); };
$("excluir").onclick = excluir;
$("modalVoltar").onclick = fecharModal;

migrar();
