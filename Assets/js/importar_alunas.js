/* Importar Alunas — Biblioteca Itinerante (Firebase Realtime Database)
   Lê listas de alunas em planilha (.xlsx/.xls), CSV (.csv) ou PDF (.pdf, com texto) e grava em:
     alunas/{curso}/{nº da chamada} = { curso, nome, chamada, whatsapp, atualizadoEm }
   Formatos aceitos:
     - planilha/CSV com coluna "Nome" (e, opcionalmente, "Nº"/"Chamada"); sem cabeçalho também funciona
       (uma coluna só de nomes, ou "número | nome");
     - PDF com linhas "número nome" (lista de presença);
     - PDF com lista de nomes com marcadores (ex.: resultado final de edital) — o nº da chamada
       passa a ser a ordem em que o nome aparece.
   - os cursos vêm do banco (cursos/), cadastrados em "Cadastro de Cursos";
   - o curso é detectado por "Curso: ..." ou pelo título do documento (ex.: "Curso FIC OPERADOR DE COMPUTADOR"),
     tolerando masculino/feminino (operador/operadora);
   - alunas novas entram com WhatsApp vazio (preenchido depois em "Cadastro de Alunas");
   - alunas que já existem NUNCA perdem o WhatsApp (só o nome é atualizado, se você permitir).
   - PDF: precisa da biblioteca pdf.js (script no importar_alunas.html). PDFs digitalizados (imagem) não funcionam. */
import { db } from "./firebase-config.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { carregarCursos } from "./cursos.js";

const $ = (id) => document.getElementById(id);

let CURSOS = {};       // { id: nome } — vem do banco
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

/* ---------- detecção do curso ---------- */
const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "dos", "das", "e", "em", "para", "a", "o", "as", "os",
  "fic", "curso", "formacao", "inicial", "continuada", "qualificacao", "profissional"
]);

// "Operadora" e "Operador" viram o mesmo radical; plural também
function radical(t) {
  return t.replace(/s$/, "").replace(/ora$/, "or");
}
function tokens(texto) {
  return norm(texto).split(/[^a-z0-9]+/).filter((t) => t && !PALAVRAS_VAZIAS.has(t)).map(radical);
}

// Descobre o curso dentro de um texto (ex.: "Curso: X" ou o título do documento),
// comparando com os cursos cadastrados. Aceita variações de gênero/plural.
function detectarCurso(texto) {
  const t = norm(texto);
  if (!t) return "";
  const conjunto = new Set(tokens(texto));
  const achados = [];
  for (const [id, nome] of Object.entries(CURSOS)) {
    const n = norm(nome);
    if (!n) continue;
    const toks = tokens(nome);
    const tudo = t.includes(n) || n.includes(t) || (toks.length && toks.every((x) => conjunto.has(x)));
    if (tudo) achados.push([id, nome, toks.length]);
  }
  // se mais de um combinar, fica com o mais específico (mais palavras / nome mais longo)
  achados.sort((a, b) => b[2] - a[2] || b[1].length - a[1].length);
  return achados.length ? achados[0][0] : "";
}

function opcoesCurso() {
  return Object.entries(CURSOS).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
}

/* ---------- validação de nomes ---------- */
// Aceita só texto que "parece nome de pessoa" (2+ palavras, sem números nem símbolos)
function nomeValido(n) {
  n = limparTxt(n);
  if (n.length < 5 || n.length > 90) return false;
  if (/[\d\/ª:@_]/.test(n)) return false;
  if (!/^\p{L}[\p{L}\s'’`´.\-]*$/u.test(n)) return false;
  if (n.split(" ").length < 2) return false;
  return !/^(edital|processo|resultado|candidatas?|aprovad|campus|curso|oferta|instituto|programa|professor|assinatura|total|observa|data|pagina|nome|lista|presenca|turma)/.test(norm(n));
}

/* ---------- leitura de planilha / CSV ---------- */
// Quando não há coluna "Nome": aceita "número | nome" ou uma coluna só de nomes
function extrairSemCabecalho(linhas) {
  const alunas = [];
  let seq = 0;
  for (const cel of linhas) {
    const c = cel.map(limparTxt).filter(Boolean);
    if (!c.length) continue;
    let num = NaN, nome = "";
    if (/^\d{1,3}$/.test(c[0]) && c[1]) { num = +c[0]; nome = c[1]; }
    else { nome = c[0]; }
    if (!nomeValido(nome)) continue;
    const chamada = Number.isFinite(num) && num > 0 ? num : seq + 1;
    seq = chamada;
    alunas.push({ chamada, nome: limparTxt(nome) });
  }
  return alunas;
}

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
  // sem "Curso:": tenta achar o curso em qualquer texto do cabeçalho (título do arquivo)
  if (!curso) {
    curso = detectarCurso(linhas.slice(0, 15).map((c) => c.map(limparTxt).join(" ")).join(" "));
  }

  // 2) cabeçalho: linha com a coluna "Nome"
  let hLinha = -1, nomeCol = -1, numCol = -1;
  for (let i = 0; i < linhas.length && hLinha < 0; i++) {
    const j = linhas[i].findIndex((c) => /^(nome|nome da aluna|nome completo|aluna|candidata)$/.test(norm(c)));
    if (j >= 0) {
      hLinha = i; nomeCol = j;
      numCol = linhas[i].findIndex((c) => /^(n[ºo°.]*|num|numero|n\.?\s*chamada|chamada)$/.test(norm(c)));
    }
  }

  if (hLinha < 0) {
    // sem cabeçalho "Nome": tenta ler como lista simples
    const alunas = extrairSemCabecalho(linhas);
    return { curso, alunas, erro: alunas.length ? "" : "Não encontrei a coluna \"Nome\" nem uma lista de nomes neste arquivo." };
  }

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

/* ---------- leitura de CSV ---------- */
// UTF-8 primeiro; se houver bytes inválidos, assume Windows-1252 (Excel brasileiro)
function decodificarTexto(buffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch (_) { return new TextDecoder("windows-1252").decode(buffer); }
}

function parseCsv(texto) {
  texto = texto.replace(/^\uFEFF/, "");
  // descobre o separador (; , ou tab) olhando as primeiras linhas
  const amostra = texto.split(/\r?\n/).slice(0, 5).join("\n");
  const [delim, qtd] = [";", ",", "\t"]
    .map((d) => [d, amostra.split(d).length - 1])
    .sort((a, b) => b[1] - a[1])[0];
  const D = qtd > 0 ? delim : ";";

  const linhas = [];
  let linha = [], cel = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { cel += '"'; i++; }
      else if (c === '"') aspas = false;
      else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === D) { linha.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(cel); cel = "";
      linhas.push(linha); linha = [];
    } else cel += c;
  }
  linha.push(cel);
  linhas.push(linha);
  return linhas.filter((l) => l.some((x) => limparTxt(x)));
}

function lerCsv(buffer) {
  const linhas = parseCsv(decodificarTexto(buffer));
  if (!linhas.length) return { curso: "", alunas: [], erro: "O arquivo CSV está vazio." };
  return extrair(linhas);
}

/* ---------- leitura de PDF ---------- */
// Cada linha do PDF vira uma lista de "células" (textos separados por espaço grande).
const BULLET = /^[\s\u2022\u2023\u2043\u204C\u204D\u2217\u25AA\u25AB\u25CB\u25CF\u25E6\u25A0\u25A1\u2013\u2014*·•\-\uE000-\uF8FF]+/;
const textoLinha = (cel) => limparTxt(cel.join(" "));

function extrairPdf(linhas) {
  const textos = linhas.map(textoLinha);
  let alunas = [];
  let inicio = textos.length;   // índice da primeira linha de aluna (o que vem antes é cabeçalho)

  // A) lista numerada: "1  Maria da Silva" (célula separada ou na mesma célula)
  const numeradas = [];
  linhas.forEach((cel, i) => {
    let num = NaN, nome = "";
    if (/^\d{1,3}$/.test(cel[0]) && cel.length > 1) { num = +cel[0]; nome = cel[1]; }
    else {
      const m = cel[0].match(/^(\d{1,3})[\s.\-)]+(\D.*)$/);   // "1 Maria da Silva" na mesma célula
      if (m) { num = +m[1]; nome = m[2]; }
    }
    nome = limparTxt(nome);
    if (num > 0 && nomeValido(nome)) numeradas.push({ i, chamada: num, nome });
  });

  if (numeradas.length >= 2) {
    alunas = numeradas.map(({ chamada, nome }) => ({ chamada, nome }));
    inicio = numeradas[0].i;
  } else {
    // B) lista com marcadores (∗ • - ...), sem número: a chamada é a ordem da lista
    const marcadas = [];
    textos.forEach((t, i) => {
      const m = t.match(BULLET);
      if (!m) return;
      const nome = limparTxt(t.slice(m[0].length));
      if (nomeValido(nome)) marcadas.push({ i, nome });
    });

    if (marcadas.length >= 2) {
      alunas = marcadas.map((x, k) => ({ chamada: k + 1, nome: x.nome }));
      inicio = marcadas[0].i;
    } else {
      // C) lista de nomes soltos, uma por linha, depois de um título
      //    como "Candidatas aprovadas", "Classificadas", "Matriculadas"...
      const h = textos.findIndex((t) => /(aprovad|classificad|matriculad|convocad|relacao de alunas|lista de alunas)/.test(norm(t)));
      if (h >= 0) {
        const soltas = [];
        for (let i = h + 1; i < textos.length; i++) if (nomeValido(textos[i])) soltas.push({ i, nome: textos[i] });
        if (soltas.length >= 2) {
          alunas = soltas.map((x, k) => ({ chamada: k + 1, nome: x.nome }));
          inicio = soltas[0].i;
        }
      }
    }
  }

  // curso: "Curso: ..." ou o título do documento (ex.: "Curso FIC OPERADOR DE COMPUTADOR ...")
  const cabecalho = textos.slice(0, Math.min(inicio, 30)).join(" ");
  let curso = "";
  const m = cabecalho.match(/curso\s*:\s*(.+)/i);
  if (m) curso = detectarCurso(m[1]);
  if (!curso) curso = detectarCurso(cabecalho);

  return {
    curso, alunas,
    erro: alunas.length ? "" : "Não encontrei alunas neste PDF. Ele precisa ter uma lista de nomes (com ou sem número)."
  };
}

async function lerPdf(buffer) {
  if (!window.pdfjsLib) return { curso: "", alunas: [], erro: "O leitor de PDF não carregou. Recarregue a página e tente de novo." };
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const linhas = [];
  let temTexto = false;

  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    const itens = conteudo.items
      .filter((i) => String(i.str).trim())
      .map((i) => ({ t: String(i.str).trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    if (itens.length) temTexto = true;

    let grupo = [], yRef = null;
    const fechar = () => {
      if (!grupo.length) return;
      grupo.sort((a, b) => a.x - b.x);
      const cel = [];
      let fim = null;
      grupo.forEach((i) => {
        if (cel.length && i.x - fim <= 8) cel[cel.length - 1] += " " + i.t;   // mesma célula
        else cel.push(i.t);                                                   // espaço grande = nova célula
        fim = i.x + i.w;
      });
      linhas.push(cel);
      grupo = [];
    };
    itens.forEach((i) => {
      if (yRef !== null && Math.abs(i.y - yRef) > 3) fechar();
      if (!grupo.length) yRef = i.y;
      grupo.push(i);
    });
    fechar();
  }

  if (!temTexto) return { curso: "", alunas: [], erro: "Este PDF não tem texto (parece digitalizado). Use uma planilha, um CSV ou um PDF gerado no computador." };
  return extrairPdf(linhas);
}

async function adicionarArquivos(lista) {
  const novos = [...lista];
  if (!novos.length) return;
  msg("Lendo arquivos...");
  await cursosPronto;     // garante que os cursos do banco já foram carregados
  for (const f of novos) {
    try {
      const buffer = await f.arrayBuffer();
      const ehPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
      const ehCsv = /\.csv$/i.test(f.name) || f.type === "text/csv";
      const r = ehPdf ? await lerPdf(buffer) : ehCsv ? lerCsv(buffer) : lerPlanilha(buffer);
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
      opcoesCurso().map(([k, v]) => `<option value="${esc(k)}"${arq.curso === k ? " selected" : ""}>${esc(v)}</option>`).join("");
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
    .map(([k, p]) => `<div><span>${esc(CURSOS[k] || k)}</span><strong>${p.nova} aluna(s) nova(s)` +
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

/* ---------- início: cursos do banco + alunas existentes ---------- */
const cursosPronto = carregarCursos(false).then((c) => { CURSOS = c; render(); }).catch(erro);

Promise.all([cursosPronto, carregarExistentes()])
  .then(() => {
    const ids = Object.keys(CURSOS);
    if (!ids.length) {
      msg("Nenhum curso cadastrado ainda. Cadastre em 'Cadastro de Cursos' antes de importar.", "erro");
      return;
    }
    const n = (c) => Object.values(existentes?.[c] || {}).filter(Boolean).length;
    msg("No banco: " + ids.map((id) => `${n(id)} aluna(s) de ${CURSOS[id]}`).join(" · ") + ".");
  })
  .catch(erro);
