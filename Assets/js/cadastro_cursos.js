/* Cadastro de Cursos — Firebase Realtime Database: cursos/{id} */
import { db } from "./firebase-config.js";
import { ref, get, set, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { CURSOS_PADRAO, gerarId } from "./cursos.js";

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const limparTxt = (v) => String(v || "").replace(/\s+/g, " ").trim();

let noBanco = {};      // cursos/ do banco
let pendente = null;   // { acao: "salvar"|"remover", id, nome }

function msg(texto, tipo) { $("status").textContent = texto || ""; $("status").className = tipo || ""; }
function erro(e) {
  console.error(e);
  const m = String((e && (e.code || e.message)) || "").toUpperCase();
  msg(m.includes("PERMISSION")
    ? "Sem permissão no banco de dados. Confira o login e as regras do Realtime Database (nó 'cursos')."
    : "Não foi possível concluir a operação. Verifique a conexão e tente novamente.", "erro");
}

function todos() {
  const lista = Object.entries(CURSOS_PADRAO).map(([id, nome]) => ({ id, nome, padrao: true }));
  Object.entries(noBanco).forEach(([id, c]) => {
    if (c && c.nome && !CURSOS_PADRAO[id]) lista.push({ id, nome: String(c.nome), padrao: false });
  });
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function render() {
  const itens = todos();
  $("contador").textContent = itens.length;
  $("lista").innerHTML = itens.map((c) =>
    `<div><span><strong>${esc(c.nome)}</strong><br><small>código: ${esc(c.id)}</small></span>` +
    (c.padrao ? '<span class="padrao">padrão</span>' : '<span></span>') +
    (c.padrao ? '' : `<button type="button" class="remover-aluna" data-id="${esc(c.id)}">Remover</button>`) +
    `</div>`).join("");
}

async function carregar() {
  try {
    const snap = await get(ref(db, "cursos"));
    noBanco = snap.val() || {};
    render();
  } catch (e) { erro(e); render(); }
}

function atualizarBotao() { $("salvar").disabled = limparTxt($("nome").value).length < 3; }
function fecharModal() { pendente = null; $("modal").hidden = true; $("modalSalvar").disabled = false; }

/* ---------- salvar ---------- */
function pedirSalvar() {
  const nome = limparTxt($("nome").value);
  const id = gerarId(nome);
  if (nome.length < 3 || !id) { msg("Informe o nome do curso.", "erro"); return; }
  if (CURSOS_PADRAO[id] || noBanco[id]) { msg("Já existe um curso com este nome.", "erro"); return; }
  msg("");
  pendente = { acao: "salvar", id, nome };
  $("modalIcon").textContent = "✓"; $("modalTitulo").textContent = "Confirmar cadastro";
  $("modalTexto").textContent = "Confira os dados do curso antes de salvar:";
  $("modalNome").textContent = nome; $("modalId").textContent = id;
  $("modalData").hidden = false; $("modalSalvar").textContent = "Salvar curso";
  $("modal").hidden = false;
}

/* ---------- remover ---------- */
async function pedirRemocao(id) {
  const c = noBanco[id];
  if (!c) return;
  try {
    // não permite remover curso que ainda tem alunas cadastradas
    const alunas = (await get(ref(db, "alunas/" + id))).val();
    if (alunas && Object.keys(alunas).length) {
      msg(`O curso "${c.nome}" ainda tem alunas cadastradas. Remova as alunas antes de remover o curso.`, "erro");
      return;
    }
  } catch (e) { return erro(e); }
  msg("");
  pendente = { acao: "remover", id, nome: c.nome };
  $("modalIcon").textContent = "🗑️"; $("modalTitulo").textContent = "Remover curso";
  $("modalTexto").textContent = "Deseja realmente remover este curso? Esta ação não pode ser desfeita.";
  $("modalNome").textContent = c.nome; $("modalId").textContent = id;
  $("modalData").hidden = false; $("modalSalvar").textContent = "Sim, remover";
  $("modal").hidden = false;
}

async function confirmar() {
  if (!pendente) return;
  const { acao, id, nome } = pendente;
  $("modalSalvar").disabled = true;
  try {
    if (acao === "salvar") {
      // confere de novo no banco para não sobrescrever um curso criado há pouco
      if ((await get(ref(db, "cursos/" + id))).exists()) {
        fecharModal(); msg("Já existe um curso com este nome.", "erro"); await carregar(); return;
      }
      await set(ref(db, "cursos/" + id), { id, nome, criadoEm: serverTimestamp() });
      $("nome").value = ""; atualizarBotao();
      fecharModal(); await carregar();
      msg(`Curso "${nome}" salvo. Ele já aparece no Cadastro de Alunas.`, "ok");
    } else {
      await remove(ref(db, "cursos/" + id));
      fecharModal(); await carregar();
      msg(`Curso "${nome}" removido.`, "ok");
    }
  } catch (e) {
    fecharModal(); erro(e);
  }
}

/* ---------- eventos ---------- */
$("nome").oninput = atualizarBotao;
$("formCurso").onsubmit = (e) => { e.preventDefault(); if (!$("salvar").disabled) pedirSalvar(); };
$("limpar").onclick = () => { $("nome").value = ""; atualizarBotao(); msg(""); };
$("modalVoltar").onclick = fecharModal;
$("modalSalvar").onclick = confirmar;
$("lista").addEventListener("click", (e) => {
  const b = e.target.closest(".remover-aluna");
  if (b) pedirRemocao(b.dataset.id);
});

render();
carregar();
