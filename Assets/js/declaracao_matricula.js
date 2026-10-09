/* Declaração de Matrícula — gera a declaração (prévia na tela + PDF) a partir do banco.
   Aluna:  alunas/{curso}/{nº}  (lista oficial de cada curso)
   CPF:    inscricoes/{cpf}     (ficha de inscrição; procurada pelo nome da aluna, de preferência no mesmo curso)
   Curso:  cursos/{id}          (nome do curso, via cursos.js)
   A carga horária é digitada; a data é a de hoje. */
import { auth, db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { carregarCursos } from "./cursos.js";
import { ALUNAS_PATH, chaveNome } from "./alunas.js";

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const soNum = (v) => String(v || "").replace(/\D/g, "");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CIDADE = "São João Nepomuceno";
const ASSINATURA = "Responsável do Campus São João Nepomuceno";

let cursos = {};          // { id: nome }
let alunas = {};          // alunas/{curso} -> { nº: aluna }
let cpfPorNome = {};      // chaveNome -> [{ cpf, curso }]

/* ---------- utilitários ---------- */
function formatarCpf(v) {
  return soNum(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function cpfValido(cpf) {
  const d = soNum(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}
const horasTexto = (n) => Number(n).toLocaleString("pt-BR");
function dataExtenso(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
function aviso(texto, tipo = "") {
  $("status").className = tipo; $("status").textContent = texto;
}

/* ---------- dados do banco ---------- */
async function carregar() {
  aviso("Carregando cursos e alunas...");
  try {
    const [c, alSnap, insSnap] = await Promise.all([
      carregarCursos(true),
      get(ref(db, ALUNAS_PATH)),
      get(ref(db, "inscricoes")).catch((e) => { console.warn("[declaração] inscrições:", e); return null; })
    ]);
    alunas = alSnap.val() || {};
    // cursos que têm alunas, com o nome do cadastro (ou o próprio id, se o curso não estiver cadastrado)
    cursos = {};
    Object.keys(alunas).forEach((id) => { if (Object.keys(alunas[id] || {}).length) cursos[id] = c[id] || id; });

    cpfPorNome = {};
    Object.entries((insSnap && insSnap.val()) || {}).forEach(([id, ins]) => {
      const nome = ins?.identificacao?.nome;
      const cpf = ins?.identificacao?.cpf || id;
      if (!nome || soNum(cpf).length !== 11) return;
      (cpfPorNome[chaveNome(nome)] ||= []).push({ cpf: formatarCpf(cpf), curso: ins?.inscricao?.curso || "" });
    });

    const lista = Object.entries(cursos).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    $("curso").innerHTML = lista.length
      ? '<option value="">Selecione o curso</option>' + lista.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")
      : '<option value="">Nenhum curso com alunas cadastradas</option>';
    $("curso").disabled = !lista.length;
    aviso(lista.length ? "Escolha o curso e a aluna." : "Nenhuma aluna cadastrada ainda. Cadastre em 'Cadastro de alunas'.", lista.length ? "" : "erro");
  } catch (e) {
    console.error(e);
    aviso(String(e?.code || e?.message || "").toUpperCase().includes("PERMISSION")
      ? "Sem permissão para ler as alunas. Entre com uma conta de administrador."
      : "Não foi possível carregar os dados. Verifique a conexão e clique em Atualizar.", "erro");
  }
}

function aoTrocarCurso() {
  const id = $("curso").value;
  const lista = Object.entries(alunas[id] || {})
    .map(([k, a]) => ({ ...a, chave: k }))
    .filter((a) => a && a.nome)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  $("aluna").innerHTML = id
    ? '<option value="">Selecione a aluna</option>' + lista.map((a) => `<option value="${esc(a.chave)}">${esc(a.nome)}</option>`).join("")
    : '<option value="">Escolha o curso primeiro</option>';
  $("aluna").disabled = !id;
  $("cpf").value = ""; $("cpfOrigem").textContent = "";
  atualizar();
}

function aoTrocarAluna() {
  const curso = $("curso").value, a = (alunas[curso] || {})[$("aluna").value];
  $("cpf").value = ""; $("cpfOrigem").className = "origem"; $("cpfOrigem").textContent = "";
  if (a) {
    const achados = cpfPorNome[chaveNome(a.nome)] || [];
    const doCurso = achados.find((x) => x.curso === curso);
    const cpf = a.cpf ? formatarCpf(a.cpf) : (doCurso || achados[0] || {}).cpf;
    if (cpf) {
      $("cpf").value = cpf;
      $("cpfOrigem").className = "origem ok";
      $("cpfOrigem").textContent = "CPF encontrado no banco (ficha de inscrição).";
    } else {
      $("cpfOrigem").className = "origem alerta";
      $("cpfOrigem").textContent = "CPF não encontrado no banco: digite o CPF da aluna.";
    }
  }
  atualizar();
}

/* ---------- prévia ---------- */
function dados() {
  const curso = $("curso").value, a = (alunas[curso] || {})[$("aluna").value];
  return {
    nome: a ? String(a.nome).replace(/\s+/g, " ").trim() : "",
    curso: curso ? cursos[curso] : "",
    cpf: $("cpf").value.trim(),
    horas: Number($("horas").value),
    tratamento: $("tratamento").value,
    data: dataExtenso()
  };
}
function problemas(d) {
  if (!d.nome) return "Selecione o curso e a aluna.";
  if (!cpfValido(d.cpf)) return "Informe um CPF válido.";
  if (!(d.horas > 0) || !Number.isInteger(d.horas)) return "Informe a carga horária em horas (número inteiro).";
  return "";
}
function textoDeclaracao(d) {
  return `Declaro para os devidos fins que ${d.nome}, CPF ${d.cpf} está ${d.tratamento} no curso ${d.curso} ` +
    `no campus ${CIDADE}, com carga horária de ${horasTexto(d.horas)} horas.`;
}

function atualizar() {
  const d = dados();
  const marca = (v, ph) => v ? `<b>${esc(v)}</b>` : `<span class="ph">${ph}</span>`;
  $("pTexto").innerHTML = `Declaro para os devidos fins que ${marca(d.nome, "nome da aluna")}, CPF ${marca(d.cpf, "000.000.000-00")} ` +
    `está ${esc(d.tratamento)} no curso ${marca(d.curso, "nome do curso")} no campus ${CIDADE}, ` +
    `com carga horária de ${marca(d.horas > 0 ? horasTexto(d.horas) : "", "___")} horas.`;
  $("pData").textContent = `${CIDADE}, ${d.data}.`;
  const p = problemas(d);
  $("btnPdf").disabled = !!p;
  $("btnPdf").title = p || "Baixar a declaração em PDF";
  if (Object.keys(cursos).length) aviso(p || "✓ Tudo certo. Confira a prévia e clique em Baixar PDF.", p ? "" : "ok");
}

/* ---------- PDF ---------- */
// Reduz o logo (PNG grande) para um JPEG leve antes de colocar no PDF
async function logo(src) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const w = Math.min(1100, img.naturalWidth), h = Math.round(w * img.naturalHeight / img.naturalWidth);
    const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const cx = cv.getContext("2d");
    cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
    return { url: cv.toDataURL("image/jpeg", 0.9), w, h };
  } catch (_) { return null; }
}

async function baixarPdf() {
  const d = dados(), p = problemas(d);
  if (p) return aviso(p, "erro");
  $("btnPdf").disabled = true; aviso("Gerando PDF...");
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = 595.28, ML = 72, MR = 72, LARG = W - ML - MR;

    // logo do campus centralizado
    const lg = await logo("if-sjn.png");
    let y = 48;
    if (lg) {
      const lw = 200, lh = lw * lg.h / lg.w;
      doc.addImage(lg.url, "JPEG", (W - lw) / 2, y, lw, lh);
      y += lh + 14;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(40);
    ["MINISTÉRIO DA EDUCAÇÃO", "SECRETARIA DE EDUCAÇÃO PROFISSIONAL E TECNOLÓGICA",
      "INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA DO SUDESTE DE MINAS GERAIS",
      "CAMPUS SÃO JOÃO NEPOMUCENO"].forEach((l) => { doc.text(l, W / 2, y, { align: "center" }); y += 12; });

    // título
    y += 50;
    doc.setFont("helvetica", "normal"); doc.setFontSize(17); doc.setTextColor(0);
    doc.text("D E C L A R A Ç Ã O   D E   M A T R Í C U L A", W / 2, y, { align: "center" });

    // texto (justificado, com recuo na primeira linha)
    y += 60;
    doc.setFontSize(12.5);
    const RECUO = 36, entre = 24, texto = textoDeclaracao(d);
    const primeira = doc.splitTextToSize(texto, LARG - RECUO)[0];
    const resto = texto.slice(primeira.length).trim();
    const linhas = [{ t: primeira, x: ML + RECUO, w: LARG - RECUO },
      ...(resto ? doc.splitTextToSize(resto, LARG) : []).map((t) => ({ t, x: ML, w: LARG }))];
    linhas.forEach((l, i) => {
      const ultima = i === linhas.length - 1;
      doc.text(l.t, l.x, y, ultima ? {} : { align: "justify", maxWidth: l.w });
      y += entre;
    });

    // local e data
    y += 40;
    doc.text(`${CIDADE}, ${d.data}.`, W - MR, y, { align: "right" });

    // assinatura
    y += 75;
    doc.setLineWidth(.7); doc.setDrawColor(0);
    doc.line(W / 2 - 140, y, W / 2 + 140, y);
    y += 16;
    doc.setFontSize(11.5);
    doc.text(ASSINATURA, W / 2, y, { align: "center" });

    const arquivo = d.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    doc.save(`${arquivo || "aluna"}-Declaracao_matricula.pdf`);
    aviso("✓ PDF gerado: " + d.nome + ".", "ok");
  } catch (e) {
    console.error(e);
    aviso("Não foi possível gerar o PDF. Tente novamente.", "erro");
  } finally {
    $("btnPdf").disabled = !!problemas(dados());
  }
}

/* ---------- eventos ---------- */
$("curso").addEventListener("change", aoTrocarCurso);
$("aluna").addEventListener("change", aoTrocarAluna);
$("cpf").addEventListener("input", () => { $("cpf").value = formatarCpf($("cpf").value); atualizar(); });
$("horas").addEventListener("input", atualizar);
$("tratamento").addEventListener("change", atualizar);
$("btnPdf").addEventListener("click", baixarPdf);
$("btnAtualizar").addEventListener("click", async () => {
  const [c, a] = [$("curso").value, $("aluna").value];
  await carregar();
  if (c && cursos[c]) { $("curso").value = c; aoTrocarCurso(); if (a) { $("aluna").value = a; aoTrocarAluna(); } }
});

atualizar();
auth.authStateReady().catch(() => {}).then(carregar);   // espera a sessão antes de ler o banco
