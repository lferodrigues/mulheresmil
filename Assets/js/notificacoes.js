/* Sino de notificações — livros com devolução atrasada (Realtime Database)
   Cria o sino sozinho no canto superior direito. Basta importar este arquivo na página. */
import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const PRAZO_DIAS = 15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

let atrasados = [];

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

/* ---------- interface ---------- */
const wrap = document.createElement("div");
wrap.className = "sino-wrap";
wrap.innerHTML = `
  <button type="button" class="sino-btn" id="sinoBtn" aria-label="Notificações" aria-haspopup="true" aria-expanded="false" title="Notificações">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="sino-badge" id="sinoBadge" hidden>0</span>
  </button>
  <div class="sino-painel" id="sinoPainel" role="dialog" aria-label="Notificações de atraso" hidden>
    <div class="sino-titulo">Devoluções atrasadas</div>
    <div class="sino-lista" id="sinoLista"></div>
    <a class="sino-link" href="./devolucao_livros.html">Ir para Devolução de Livros →</a>
  </div>`;
document.body.appendChild(wrap);

const btn = wrap.querySelector("#sinoBtn");
const badge = wrap.querySelector("#sinoBadge");
const painel = wrap.querySelector("#sinoPainel");
const lista = wrap.querySelector("#sinoLista");

function render() {
  const n = atrasados.length;
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  btn.classList.toggle("tem-alerta", n > 0);
  btn.setAttribute("aria-label", n ? `Notificações: ${n} livro(s) atrasado(s)` : "Notificações: nenhum atraso");

  if (!n) {
    lista.innerHTML = '<div class="sino-vazio">Nenhum livro atrasado. 🎉</div>';
    return;
  }
  lista.innerHTML = atrasados.map((a) => `
    <div class="sino-item">
      <strong>${esc(a.aluna)}</strong>
      <span>📖 ${esc(a.titulo)}</span>
      <em>${a.dias} ${a.dias === 1 ? "dia" : "dias"} de atraso</em>
    </div>`).join("");
}

function abrir(abrirPainel) {
  painel.hidden = !abrirPainel;
  btn.setAttribute("aria-expanded", String(abrirPainel));
}

btn.addEventListener("click", (e) => { e.stopPropagation(); abrir(painel.hidden); });
painel.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => abrir(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrir(false); });

/* ---------- dados em tempo real ---------- */
let livros = {};

function recalcular() {
  atrasados = Object.entries(livros)
    .map(([id, l]) => ({
      id,
      aluna: l.aluna || l.nomeAluna || l.alunaNome || l.reservadoPara || "Aluna não informada",
      titulo: l.titulo || l.title || l.codigo || id,
      dias: diasDeAtraso(l)
    }))
    .filter((x) => x.dias > 0)
    .sort((a, b) => b.dias - a.dias);
  render();
}

onValue(ref(db, "livros"), (snap) => {
  livros = snap.val() || {};
  recalcular();
}, (e) => console.error("[notificacoes] erro ao ler livros:", e));

// Atualiza a contagem quando o dia virar com a página aberta
setInterval(recalcular, 60 * 1000);
render();
