/* Reserva de Livros — Biblioteca Itinerante (Realtime Database)
   Grava em:
   - emprestimos/{id}: quem reservou, qual livro e a data da reserva
   - livros/{id}: marca o livro como emprestado (a consulta lê daqui) */
import { db } from "./firebase-config.js";
import {
  ref, get, push, set, update, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { carregarCursos } from "./cursos.js";
import { sincronizarInscricoes } from "./alunas.js";

const PRAZO_DIAS = 15;
const $ = (id) => document.getElementById(id);
const NOMES_CURSO = { assistente: "Assistente Escolar", operadora: "Operadora de Computador" };

let livros = {};          // livros/{id}
let alunas = [];          // lista achatada de alunas cadastradas
let livroSel = null;      // { id, ...dados }
let alunaSel = null;
let dataPendente = 0;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm = (t) => String(t || "").trim().toLocaleLowerCase("pt-BR");
const fmt = (ms) => new Date(ms).toLocaleDateString("pt-BR");
const prazo = (ms) => ms + PRAZO_DIAS * 86400000;

function erro(e) {
  console.error(e);
  const msg = String((e && (e.code || e.message)) || "").toUpperCase();
  alert(msg.includes("PERMISSION")
    ? "Sem permissão no banco de dados. Verifique as regras do Realtime Database e o login."
    : "Não foi possível concluir a operação. Verifique a conexão e tente novamente.");
}

/* ---------- carregamento ---------- */
async function carregarAlunas() {
  // traz para a lista quem foi inscrita em inscricao.html e ainda não está no curso
  try { await sincronizarInscricoes(db, await carregarCursos(false)); }
  catch (e) { console.error("[reserva] sincronizar inscrições:", e); }
  const snap = await get(ref(db, "alunas"));
  const dados = snap.val() || {};
  alunas = [];
  Object.entries(dados).forEach(([curso, porChamada]) => {
    Object.entries(porChamada || {}).forEach(([chamada, a]) => {
      if (a && a.nome) alunas.push({ ...a, curso: a.curso || curso, chamada: a.chamada ?? chamada });
    });
  });
  alunas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  $("status").textContent = alunas.length
    ? alunas.length + " aluna(s) cadastrada(s)."
    : "Nenhuma aluna cadastrada ainda. Cadastre em 'Cadastro de Alunos'.";
}

onValue(ref(db, "livros"), (snap) => {
  livros = snap.val() || {};
  if (livroSel && livros[livroSel.id]?.reservado) limparLivro(); // alguém reservou agora
  sugerirLivros();
}, erro);

onValue(ref(db, "emprestimos"), (snap) => {
  const todos = Object.entries(snap.val() || {}).map(([id, e]) => ({ id, ...e }))
    .filter((e) => e.status === "emprestado")
    .sort((a, b) => b.dataReserva - a.dataReserva);
  $("reservas").hidden = !todos.length;
  $("contador").textContent = todos.length;
  const agora = Date.now();
  $("lista").innerHTML = todos.map((e) => {
    const atrasado = agora > prazo(e.dataReserva);
    return `<div><strong>${esc(e.codigo)} — ${esc(e.titulo)}</strong>
      <small>Aluna: ${esc(e.alunaNome)} (${esc(NOMES_CURSO[e.alunaCurso] || e.alunaCurso)})</small>
      <small>Reservado em ${fmt(e.dataReserva)} · devolver até <span class="${atrasado ? "atrasado" : ""}">${fmt(prazo(e.dataReserva))}${atrasado ? " (atrasado)" : ""}</span></small></div>`;
  }).join("");
}, erro);

/* ---------- busca de livro ---------- */
function sugerirLivros() {
  const q = norm($("buscaLivro").value), box = $("sugLivro");
  if (!q || livroSel) { box.hidden = true; return; }
  const achados = Object.entries(livros)
    .map(([id, l]) => ({ id, ...l }))
    .filter((l) => !l.reservado && l.status !== "emprestado")
    .filter((l) => norm(l.codigo || l.id).includes(q) || norm(l.titulo).includes(q))
    .slice(0, 20);
  box.innerHTML = achados.length ? "" : '<div class="sem-resultado">Nenhum livro disponível encontrado.</div>';
  achados.forEach((l) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sug";
    b.innerHTML = `<strong>${esc(l.titulo)}</strong><span>${esc(l.codigo || l.id)} · ${esc(l.autor)}</span>`;
    b.onclick = () => escolherLivro(l);
    box.appendChild(b);
  });
  box.hidden = false;
}
function escolherLivro(l) {
  livroSel = l;
  $("buscaLivro").value = ""; $("buscaLivro").hidden = true;
  $("sugLivro").hidden = true;
  $("boxLivro").hidden = false;
  $("boxLivro").innerHTML = `<b>${esc(l.titulo)}</b><small>Código ${esc(l.codigo || l.id)} · ${esc(l.autor)}</small>
    <small><a href="#" id="trocaLivro" style="margin:0;display:inline">trocar livro</a></small>`;
  $("trocaLivro").onclick = (e) => { e.preventDefault(); limparLivro(); $("buscaLivro").focus(); };
  atualizarBotao();
}
function limparLivro() {
  livroSel = null; $("boxLivro").hidden = true; $("buscaLivro").hidden = false; $("buscaLivro").value = "";
  atualizarBotao();
}

/* ---------- busca de aluna ---------- */
function sugerirAlunas() {
  const q = norm($("buscaAluna").value), box = $("sugAluna");
  if (!q || alunaSel) { box.hidden = true; return; }
  const achadas = alunas.filter((a) => norm(a.nome).includes(q)).slice(0, 20);
  box.innerHTML = achadas.length ? "" : '<div class="sem-resultado">Nenhuma aluna cadastrada encontrada.</div>';
  achadas.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sug";
    b.innerHTML = `<strong>${esc(a.nome)}</strong><span>${esc(NOMES_CURSO[a.curso] || a.curso)}</span>`;
    b.onclick = () => escolherAluna(a);
    box.appendChild(b);
  });
  box.hidden = false;
}
function escolherAluna(a) {
  alunaSel = a;
  $("buscaAluna").value = ""; $("buscaAluna").hidden = true;
  $("sugAluna").hidden = true;
  $("boxAluna").hidden = false;
  $("boxAluna").innerHTML = `<b>${esc(a.nome)}</b><small>${esc(NOMES_CURSO[a.curso] || a.curso)} · chamada ${esc(a.chamada)} · ${esc(a.whatsapp || "sem WhatsApp")}</small>
    <small><a href="#" id="trocaAluna" style="margin:0;display:inline">trocar aluna</a></small>`;
  $("trocaAluna").onclick = (e) => { e.preventDefault(); limparAluna(); $("buscaAluna").focus(); };
  atualizarBotao();
}
function limparAluna() {
  alunaSel = null; $("boxAluna").hidden = true; $("buscaAluna").hidden = false; $("buscaAluna").value = "";
  atualizarBotao();
}

function atualizarBotao() { $("reservar").disabled = !(livroSel && alunaSel); }
function limparTudo() { limparLivro(); limparAluna(); }

/* ---------- reserva ---------- */
function abrirConfirmacao() {
  if (!livroSel || !alunaSel) return;
  dataPendente = Date.now();
  $("mLivro").textContent = `${livroSel.codigo || livroSel.id} — ${livroSel.titulo}`;
  $("mAluna").textContent = `${alunaSel.nome} (${NOMES_CURSO[alunaSel.curso] || alunaSel.curso})`;
  $("mData").textContent = fmt(dataPendente);
  $("mPrazo").textContent = fmt(prazo(dataPendente));
  $("modal").hidden = false;
}

async function confirmarReserva() {
  const btn = $("modalConfirmar");
  btn.disabled = true;
  const livro = livroSel, aluna = alunaSel, quando = dataPendente;
  try {
    const novo = push(ref(db, "emprestimos"));
    const idEmp = novo.key;

    // 1) Trava o livro de forma atômica (evita duas reservas ao mesmo tempo)
    const res = await runTransaction(ref(db, "livros/" + livro.id), (atual) => {
      if (atual === null) return atual;
      if (atual.reservado || atual.status === "emprestado") return; // aborta
      return {
        ...atual,
        status: "emprestado",
        reservado: true,
        emprestimoId: idEmp,
        aluna: aluna.nome,
        alunaCurso: aluna.curso,
        alunaChamada: aluna.chamada,
        dataReserva: quando,
        dataDevolucao: ""
      };
    });
    if (!res.committed) {
      alert("Este livro acabou de ser reservado por outra pessoa. Escolha outro.");
      $("modal").hidden = true; limparLivro();
      return;
    }

    // 2) Registro do empréstimo (histórico: quem, qual livro, quando)
    await set(novo, {
      livroId: livro.id,
      codigo: livro.codigo || livro.id,
      titulo: livro.titulo || "",
      alunaNome: aluna.nome,
      alunaCurso: aluna.curso,
      alunaChamada: aluna.chamada,
      alunaWhatsapp: aluna.whatsapp || "",
      dataReserva: quando,
      prazoDevolucao: prazo(quando),
      status: "emprestado"
    });

    $("modal").hidden = true;
    limparTudo();
    $("status").textContent = `Reserva registrada: "${livro.titulo}" para ${aluna.nome}.`;
  } catch (e) {
    erro(e);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- eventos ---------- */
$("buscaLivro").oninput = sugerirLivros;
$("buscaAluna").oninput = sugerirAlunas;
$("reservar").onclick = abrirConfirmacao;
$("limpar").onclick = limparTudo;
$("modalVoltar").onclick = () => { $("modal").hidden = true; };
$("modalConfirmar").onclick = confirmarReserva;

carregarAlunas().catch(erro);
