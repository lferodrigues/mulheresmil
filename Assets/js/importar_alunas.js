/* Importar Alunas — Biblioteca Itinerante (Firebase Realtime Database)
   Lê planilhas de lista de presença (.xlsx/.xls/.csv) e grava as alunas em:
     alunas/{curso}/{nº da chamada} = { curso, nome, chamada, whatsapp, atualizadoEm }
   - alunas novas entram com WhatsApp vazio (preenchido depois em "Cadastro de Alunas");
   - alunas que já existem NUNCA perdem o WhatsApp (só o nome é atualizado, se você permitir). */
import { db } from "./firebase-config.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const $ = (id) => document.getElementById(id);
const CURSOS = { operadora: "Operadora de Computador", assistente: "Assistente Escolar" };

let arquivos = [];     // { nome, curso, alunas:[{chamada,nome,status,atual}], erro }
let existentes = {};   // alunas/ do banco

/* ---------- utilidades ---------- */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const limparTxt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const norm = (v) => limparTxt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function msg(texto, tipo) {
  $("status").textContent = texto || "";
  $("status").className = tipo || "";
}
function erro(e) {
  console.error(e);
  const m = String((e && (e.code || e.message)) || "").toUpperCase();
  msg(m.includes("PERMISSION")
    ? "Sem permissão no banco de dados. Verifique as regras do Realtime Database e o login."
    : "Não foi possível concluir a operação. Verifique a conexão e tente novamente.", "erro");
}

function detectarCurso(texto) {
  const t = norm(texto);
  if (t.includes("operadora") || t.includes("computador")) return "operadora";
  if (t.includes("assistente") || t.includes("escolar")) return "assistente";
  return "";
}

/* ---------- leitura da planilha ---------- */
function extrair(linhas) {
  // 1) curso: procura "Curso: ..." nas primeiras linhas
  let curso = "";
  for (let i = 0; i < Math.min(linhas.length, 15) && !curso; i++) {
    const cel = linhas[i];
    for (let j = 0; j < cel.length && !curso; j++) {
      const txt = limparTxt(cel[j]);
      let m = txt.match(/curso\s*:\s*(.+)/i);
      if (m) { curso = detectarCurso(m[1]); continue; }
      if (/^curso\s*:?$/i.test(txt)) {           // "Curso:" numa célula e o nome na seguinte
        const prox = cel.slice(j + 1).map(limparTxt).find(Boolean);
        if (prox) curso = detectarCurso(prox);
      }
    }
  }

  // 2) cabeçalho: linha com a coluna "Nome"
  let hLinha = -1, nomeCol = -1, numCol = -1;
  for (let i = 0; i < linhas.length && hLinha < 0; i++) {
    const j = linhas[i].findIndex((c) => /^(nome|nome da aluna|nome completo|aluna)$/.test(norm(c)));
    if (j >= 0) {
      hLinha = i; nomeCol = j;
      numCol = linhas[i].findIndex((c) => /^(n[ºo°.]*|num|numero|n\.?\s*chamada|chamada)$/.test(norm(c)));
    }
  }
  if (hLinha < 0) return { curso, alunas: [], erro: "Não encontrei a coluna \"Nome\" nesta planilha." };

  // 3) alunas
  const alunas = [];
  let seq = 0;
  for (let i = hLinha + 1; i < linhas.length; i++) {
    const nome = limparTxt(linhas[i][nomeCol]);
    if (!nome || /^\d+$/.test(nome)) continue;
    if (/^(professor|professora|assinatura|total|observa)/.test(norm(nome))) continue;
    const n = numCol >= 0 ? parseInt(linhas[i][numCol], 10) : NaN;
    const chamada = Number.isFinite(n) && n > 0 ? n : seq + 1;
    seq = chamada;
    alunas.push({ chamada, nome });
  }
  return { curso, alunas, erro: alunas.length ? "" : "Nenhum nome encontrado abaixo do cabeçalho." };
}

function lerPlanilha(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  let ultimo = { curso: "", alunas: [], erro: "A planilha está vazia." };
  for (const aba of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: "", blankrows: false });
    const r = extrair(linhas);
    if (r.alunas.length) return r;
    ultimo = r;
  }
  return ultimo;
}

async function adicionarArquivos(lista) {
  const novos = [...lista];
  if (!novos.length) return;
  msg("Lendo planilhas...");
  for (const f of novos) {
    try {
      const r = lerPlanilha(await f.arrayBuffer());
      arquivos.push({ nome: f.name, curso: r.curso, alunas: r.alunas, erro: r.erro });
    } catch (e) {
      console.error(e);
      arquivos.push({ nome: f.name, curso: "", alunas: [], erro: "Não foi possível ler este arquivo." });
    }
  }
  msg("");
  render();
}

/* ---------- banco ---------- */
async function carregarExistentes() {
  const snap = await get(ref(db, "alunas"));
  existentes = snap.val() || {};
}

function classificar() {
  const vistos = new Set();
  arquivos.forEach((arq) => arq.alunas.forEach((a) => {
    a.atual = "";
    if (!arq.curso) { a.status = "semcurso"; return; }
    const chave = arq.curso + "|" + a.chamada;
    if (vistos.has(chave)) { a.status = "duplicada"; return; }
    vistos.add(chave);
    const ex = existentes?.[arq.curso]?.[a.chamada];
    if (!ex || !ex.nome) a.status = "nova";
    else if (norm(ex.nome) === norm(a.nome)) a.status = "igual";
    else { a.status = "diferente"; a.atual = ex.nome; }
  }));
}

/* ---------- tela ---------- */
const ROTULOS = {
  nova: "Nova", igual: "Já cadastrada", diferente: "Nome diferente",
  duplicada: "Nº repetido (ignorada)", semcurso: "Escolha o curso"
};

function contar() {
  const c = { nova: 0, igual: 0, diferente: 0, duplicada: 0, semcurso: 0 };
  arquivos.forEach((arq) => arq.alunas.forEach((a) => c[a.status]++));
  return c;
}

function render() {
  classificar();
  $("arquivos").innerHTML = arquivos.map((arq, i) => {
    const c = { nova: 0, igual: 0, diferente: 0 };
    arq.alunas.forEach((a) => { if (c[a.status] !== undefined) c[a.status]++; });
    const opcoes = '<option value="">Selecione o curso</option>' +
      Object.entries(CURSOS).map(([k, v]) => `<option value="${k}"${arq.curso === k ? " selected" : ""}>${v}</option>`).join("");
    const corpo = arq.erro
      ? `<div class="arq-erro">${esc(arq.erro)}</div>`
      : `<div class="arq-info">${arq.alunas.length} aluna(s) encontrada(s) · ${c.nova} nova(s) · ${c.igual} já cadastrada(s) · ${c.diferente} com nome diferente</div>
         <div class="arq-lista">${arq.alunas.map((a) => `
           <div class="linha"><b class="num">${esc(a.chamada)}</b><span>${esc(a.nome)}</span>
             <span class="tag ${a.status}">${ROTULOS[a.status]}</span>
             ${a.atual ? `<span class="detalhe">No banco: ${esc(a.atual)}</span>` : ""}
           </div>`).join("")}</div>`;
    return `<div class="arq">
      <div class="arq-topo">
        <span class="arq-nome">📄 ${esc(arq.nome)}</span>
        <select data-i="${i}" class="${arq.curso ? "" : "falta"}" aria-label="Curso">${opcoes}</select>
        <button type="button" class="arq-remover" data-i="${i}">Remover</button>
      </div>${corpo}</div>`;
  }).join("");

  const c = contar();
  $("rodape").hidden = !arquivos.length;
  $("resumo").innerHTML = ["nova", "igual", "diferente", "duplicada", "semcurso"]
    .filter((k) => c[k]).map((k) => `<span class="${k}">${c[k]} ${ROTULOS[k].toLowerCase()}</span>`).join("");
  atualizarBotao();
}

function totalParaSalvar() {
  const c = contar();
  return c.nova + ($("chkAtualizar").checked ? c.diferente : 0);
}
function atualizarBotao() { $("salvar").disabled = totalParaSalvar() === 0; }

function limparTudo() {
  arquivos = [];
  $("arquivo").value = "";
  $("chkAtualizar").checked = false;
  render();
}

/* ---------- confirmação e gravação ---------- */
function abrirConfirmacao() {
  classificar();
  const atualizar = $("chkAtualizar").checked;
  const porCurso = {};
  arquivos.forEach((arq) => arq.alunas.forEach((a) => {
    const p = porCurso[arq.curso] ||= { nova: 0, diferente: 0 };
    if (a.status === "nova") p.nova++;
    if (a.status === "diferente" && atualizar) p.diferente++;
  }));
  $("modalResumo").innerHTML = Object.entries(porCurso)
    .filter(([k, p]) => k && (p.nova || p.diferente))
    .map(([k, p]) => `<div><span>${esc(CURSOS[k])}</span><strong>${p.nova} aluna(s) nova(s)` +
      `${p.diferente ? ` · ${p.diferente} nome(s) atualizado(s)` : ""}</strong></div>`).join("");
  $("modal").hidden = false;
}
const fecharModal = () => { $("modal").hidden = true; };

async function confirmarSalvar() {
  const btn = $("modalConfirmar");
  btn.disabled = true;
  try {
    await carregarExistentes();   // estado mais recente antes de gravar
    classificar();
    const atualizar = $("chkAtualizar").checked;
    const agora = new Date().toISOString();
    const up = {};
    let novas = 0, atualizadas = 0;

    arquivos.forEach((arq) => arq.alunas.forEach((a) => {
      const p = `alunas/${arq.curso}/${a.chamada}`;
      if (a.status === "nova") {
        up[p] = { curso: arq.curso, nome: a.nome, chamada: a.chamada, whatsapp: "", atualizadoEm: agora };
        novas++;
      } else if (a.status === "diferente" && atualizar) {
        // caminhos individuais: preserva o WhatsApp já cadastrado
        up[p + "/nome"] = a.nome;
        up[p + "/curso"] = arq.curso;
        up[p + "/chamada"] = a.chamada;
        up[p + "/atualizadoEm"] = agora;
        atualizadas++;
      }
    }));

    if (!novas && !atualizadas) { fecharModal(); render(); msg("Nada novo para salvar."); return; }

    await update(ref(db), up);
    fecharModal();
    limparTudo();
    await carregarExistentes();
    msg(`Importação concluída: ${novas} aluna(s) nova(s)` +
      (atualizadas ? ` e ${atualizadas} nome(s) atualizado(s)` : "") +
      ". Cadastre o WhatsApp em 'Cadastro de Alunas'.", "ok");
  } catch (e) {
    fecharModal();
    erro(e);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- eventos ---------- */
$("arquivo").onchange = (e) => { adicionarArquivos(e.target.files); e.target.value = ""; };
["dragenter", "dragover"].forEach((ev) => $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.add("sobre"); }));
["dragleave", "drop"].forEach((ev) => $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.remove("sobre"); }));
$("drop").addEventListener("drop", (e) => adicionarArquivos(e.dataTransfer.files));

$("arquivos").addEventListener("change", (e) => {
  const s = e.target.closest("select[data-i]");
  if (!s) return;
  arquivos[+s.dataset.i].curso = s.value;
  render();
});
$("arquivos").addEventListener("click", (e) => {
  const b = e.target.closest(".arq-remover");
  if (!b) return;
  arquivos.splice(+b.dataset.i, 1);
  render();
});
$("chkAtualizar").onchange = () => { atualizarBotao(); };
$("salvar").onclick = abrirConfirmacao;
$("limpar").onclick = () => { limparTudo(); msg(""); };
$("modalVoltar").onclick = fecharModal;
$("modalConfirmar").onclick = confirmarSalvar;

carregarExistentes()
  .then(() => {
    const n = (c) => Object.values(existentes?.[c] || {}).filter(Boolean).length;
    msg(`No banco: ${n("operadora")} aluna(s) de Operadora de Computador e ${n("assistente")} de Assistente Escolar.`);
  })
  .catch(erro);
