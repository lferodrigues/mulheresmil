/* Sino de notificações — livros com devolução atrasada (Realtime Database)
   Cria o sino sozinho no canto superior direito. Basta importar este arquivo na página.
   Ao clicar em um atraso, abre um pop-up com o nome da aluna, o WhatsApp e o botão
   para enviar a mensagem de cobrança pelo WhatsApp. */
import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const PRAZO_DIAS = 15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

let atrasados = [];
let livros = {};
let alunasDb = {};      // alunas/{curso}/{chamada}
let selecionadoId = null;

/* ---------- utilidades (mesma regra da Consulta/Devolução) ---------- */
function bruto(obj, ...chaves) {
  for (const c of chaves) if (obj[c] !== undefined && obj[c] !== null && obj[c] !== "") return obj[c];
  return null;
}
function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function parseData(v) {
  if (v === null || v === undefined || v === "") return null;
  let d = null;
  if (typeof v === "number") d = new Date(v);
  else if (typeof v === "object" && typeof v.seconds === "number") d = new Date(v.seconds * 1000);
  else if (typeof v === "string") {
    const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (br) d = new Date(+br[3], +br[2] - 1, +br[1]);
    else if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    else d = new Date(v);
  }
  return d && !isNaN(d) ? d : null;
}
const diaInicial = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasEntre = (a, b) => Math.round((diaInicial(b) - diaInicial(a)) / MS_POR_DIA);
const normNome = (t) => String(t || "").trim().toLocaleLowerCase("pt-BR");
const textoDias = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;

function estaReservado(l) {
  return Boolean(l.reservado || l.reserva || l.status === "reservado" || l.status === "Reservado" || l.status === "emprestado");
}

/* Retorna os dias de atraso (0 se não estiver atrasado) */
function diasDeAtraso(livro, hoje = new Date()) {
  const inicio = parseData(bruto(livro, "dataReserva", "data_reserva", "reservadoEm", "dataEmprestimo", "dataInicio"));
  const devolucao = parseData(bruto(livro, "dataDevolucao", "data_devolucao", "devolvidoEm", "dataDevolvido"));
  const devolvido = devolucao && (!inicio || devolucao >= inicio);
  if (devolvido || !inicio || !estaReservado(livro)) return 0;
  const dias = diasEntre(inicio, hoje);
  return dias > PRAZO_DIAS ? dias - PRAZO_DIAS : 0;
}

/* ---------- WhatsApp ---------- */
// Procura o WhatsApp da aluna: primeiro por curso+chamada, depois pelo nome.
function buscarWhatsapp(livro, nomeAluna) {
  const curso = livro.alunaCurso, chamada = livro.alunaChamada;
  const direto = curso && chamada != null ? alunasDb?.[curso]?.[chamada]?.whatsapp : "";
  if (direto) return String(direto);

  const alvo = normNome(nomeAluna);
  if (!alvo) return "";
  for (const porChamada of Object.values(alunasDb || {})) {
    for (const a of Object.values(porChamada || {})) {
      if (a && normNome(a.nome) === alvo && a.whatsapp) return String(a.whatsapp);
    }
  }
  return "";
}

// Deixa só números e garante o código do Brasil (55)
function numeroWhatsapp(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("0")) n = n.replace(/^0+/, "");
  if (!(n.startsWith("55") && n.length >= 12)) n = "55" + n;
  return n;
}

function montarMensagem(item) {
  const primeiro = String(item.aluna || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiro ? `Olá, ${primeiro}! Tudo bem?` : "Olá! Tudo bem?";
  return `${saudacao} Aqui é da Biblioteca Itinerante do projeto Mulheres Mil. ` +
    `Passando para avisar que o livro "${item.titulo}" está com ${textoDias(item.dias)} de atraso na devolução. ` +
    `Você consegue devolvê-lo assim que possível? Obrigada! 📚`;
}

/* ---------- interface: sino ---------- */
const wrap = document.createElement("div");
wrap.className = "sino-wrap";
wrap.innerHTML = `
  <button type="button" class="sino-btn" id="sinoBtn" aria-label="Notificações" aria-haspopup="true" aria-expanded="false" title="Notificações">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="sino-badge zero" id="sinoBadge">0</span>
  </button>
  <div class="sino-painel" id="sinoPainel" role="dialog" aria-label="Notificações de atraso" hidden>
    <div class="sino-titulo">Devoluções atrasadas</div>
    <div class="sino-lista" id="sinoLista"></div>
    <a class="sino-link" href="./devolucao_livros.html">Ir para Devolução de Livros →</a>
  </div>`;
document.body.appendChild(wrap);

/* ---------- interface: pop-up da aluna ---------- */
const modal = document.createElement("div");
modal.className = "sino-modal";
modal.hidden = true;
modal.innerHTML = `
  <div class="sino-modal-box" role="dialog" aria-modal="true" aria-labelledby="sinoModalTitulo">
    <div class="sino-modal-icone">⏰</div>
    <h2 id="sinoModalTitulo">Livro com devolução atrasada</h2>
    <p class="sino-modal-texto">Envie um lembrete para a aluna pelo WhatsApp.</p>
    <div class="sino-modal-dados">
      <div><span>Aluna</span><strong id="sinoMAluna"></strong></div>
      <div><span>WhatsApp</span><strong id="sinoMZap"></strong></div>
      <div><span>Livro</span><strong id="sinoMLivro"></strong></div>
      <div><span>Atraso</span><strong id="sinoMAtraso" class="sino-atraso"></strong></div>
    </div>
    <p class="sino-modal-aviso" id="sinoMAviso" hidden></p>
    <div class="sino-modal-acoes">
      <button type="button" class="sino-m-fechar" id="sinoMFechar">Fechar</button>
      <a class="sino-m-enviar" id="sinoMEnviar" href="#" target="_blank" rel="noopener noreferrer">💬 Enviar mensagem</a>
    </div>
  </div>`;
document.body.appendChild(modal);

const btn = wrap.querySelector("#sinoBtn");
const badge = wrap.querySelector("#sinoBadge");
const painel = wrap.querySelector("#sinoPainel");
const lista = wrap.querySelector("#sinoLista");

const mAluna = modal.querySelector("#sinoMAluna");
const mZap = modal.querySelector("#sinoMZap");
const mLivro = modal.querySelector("#sinoMLivro");
const mAtraso = modal.querySelector("#sinoMAtraso");
const mAviso = modal.querySelector("#sinoMAviso");
const mEnviar = modal.querySelector("#sinoMEnviar");

function render() {
  const n = atrasados.length;
  badge.classList.toggle("zero", n === 0);
  badge.textContent = n > 99 ? "99+" : String(n);
  btn.classList.toggle("tem-alerta", n > 0);
  btn.setAttribute("aria-label", n ? `Notificações: ${n} livro(s) atrasado(s)` : "Notificações: nenhum atraso");

  if (!n) {
    lista.innerHTML = '<div class="sino-vazio">Nenhum livro atrasado. 🎉</div>';
    return;
  }
  lista.innerHTML = atrasados.map((a) => `
    <button type="button" class="sino-item" data-id="${esc(a.id)}" title="Clique para avisar a aluna">
      <strong>${esc(a.aluna)}</strong>
      <span>📖 ${esc(a.titulo)}</span>
      <em>${textoDias(a.dias)} de atraso</em>
    </button>`).join("");
}

function abrir(abrirPainel) {
  painel.hidden = !abrirPainel;
  btn.setAttribute("aria-expanded", String(abrirPainel));
}

/* ---------- pop-up ---------- */
function preencherModal() {
  const item = atrasados.find((a) => a.id === selecionadoId);
  if (!item) { fecharModal(); return; }

  mAluna.textContent = item.aluna;
  mLivro.textContent = item.titulo;
  mAtraso.textContent = `${textoDias(item.dias)} de atraso`;

  const numero = numeroWhatsapp(item.whatsapp);
  if (numero) {
    mZap.textContent = item.whatsapp;
    mAviso.hidden = true;
    mEnviar.classList.remove("desativado");
    mEnviar.removeAttribute("aria-disabled");
    mEnviar.href = `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagem(item))}`;
  } else {
    mZap.textContent = "Não cadastrado";
    mAviso.textContent = "Esta aluna não tem WhatsApp cadastrado. Cadastre em 'Cadastro de Alunas' para poder enviar a mensagem.";
    mAviso.hidden = false;
    mEnviar.classList.add("desativado");
    mEnviar.setAttribute("aria-disabled", "true");
    mEnviar.href = "#";
  }
}

function abrirModal(id) {
  selecionadoId = id;
  abrir(false);
  preencherModal();
  modal.hidden = false;
  mEnviar.focus();
}
function fecharModal() {
  selecionadoId = null;
  modal.hidden = true;
}

mEnviar.addEventListener("click", (e) => {
  if (mEnviar.classList.contains("desativado")) e.preventDefault();
});
modal.querySelector("#sinoMFechar").addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

/* ---------- eventos do sino ---------- */
btn.addEventListener("click", (e) => { e.stopPropagation(); abrir(painel.hidden); });
painel.addEventListener("click", (e) => e.stopPropagation());
lista.addEventListener("click", (e) => {
  const item = e.target.closest(".sino-item");
  if (item) abrirModal(item.dataset.id);
});
document.addEventListener("click", () => abrir(false));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modal.hidden) fecharModal(); else abrir(false);
});

/* ---------- dados em tempo real ---------- */
function recalcular() {
  atrasados = Object.entries(livros)
    .map(([id, l]) => {
      const aluna = l.aluna || l.nomeAluna || l.alunaNome || l.reservadoPara || "Aluna não informada";
      return {
        id,
        aluna,
        titulo: l.titulo || l.title || l.codigo || id,
        dias: diasDeAtraso(l),
        whatsapp: buscarWhatsapp(l, aluna)
      };
    })
    .filter((x) => x.dias > 0)
    .sort((a, b) => b.dias - a.dias);
  render();
  if (!modal.hidden) preencherModal();   // mantém o pop-up atualizado
}

onValue(ref(db, "livros"), (snap) => {
  livros = snap.val() || {};
  recalcular();
}, (e) => console.error("[notificacoes] erro ao ler livros:", e));

onValue(ref(db, "alunas"), (snap) => {
  alunasDb = snap.val() || {};
  recalcular();
}, (e) => console.error("[notificacoes] erro ao ler alunas:", e));

// Atualiza a contagem quando o dia virar com a página aberta
setInterval(recalcular, 60 * 1000);
render();
