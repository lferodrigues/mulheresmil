/* Logs de acesso — grava em logsAcesso/{id} (Realtime Database).
   Tipos: login, logout, cadastro (imediatos) e pagina, clique, selecao (em lote, via rastreamento.js).
   Cada registro leva: uid, email, ip, sessao, pagina, url, data (servidor), quando (relógio do aparelho),
   navegador, idioma, tela e fuso. NUNCA grava o conteúdo de campos digitados (senhas, textos).
   Nunca lança erro: em falha, apenas registra no console. */
import { auth, db } from "./firebase-config.js";
import { ref, push, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

/* ---------- sessão (agrupa tudo o que a pessoa fez numa visita) ---------- */
const SESSAO = (() => {
  let s = null;
  try { s = sessionStorage.getItem("mm_sessao"); } catch (_) {}
  if (!s) {
    s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem("mm_sessao", s); } catch (_) {}
  }
  return s;
})();

/* ---------- IP público (serviço externo ipify; guardado na sessão) ---------- */
let ipPromise = null;
export function obterIp() {
  if (ipPromise) return ipPromise;
  ipPromise = (async () => {
    try { const c = sessionStorage.getItem("mm_ip"); if (c) return c; } catch (_) {}
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch("https://api.ipify.org?format=json", { signal: ctl.signal, cache: "no-store" });
      clearTimeout(t);
      const ip = String((await r.json()).ip || "");
      if (ip) { try { sessionStorage.setItem("mm_ip", ip); } catch (_) {} }
      return ip;
    } catch (_) { return ""; }
  })().then((ip) => { if (!ip) ipPromise = null; return ip; });
  return ipPromise;
}
obterIp(); // pré-carrega para já estar pronto no login

/* ---------- montagem e gravação ---------- */
function montar(tipo, extra, user) {
  return {
    uid: user.uid,
    email: user.email || "",
    tipo,
    sessao: SESSAO,
    pagina: location.pathname.split("/").pop() || "index.html",
    url: location.pathname + location.search,
    data: serverTimestamp(),
    quando: Date.now(),
    navegador: String(navigator.userAgent || "").slice(0, 200),
    idioma: navigator.language || "",
    tela: screen.width + "x" + screen.height,
    fuso: (Intl.DateTimeFormat().resolvedOptions().timeZone) || "",
    ...extra
  };
}

async function gravar(itens) {
  if (!itens.length) return true;
  const ip = await obterIp();
  const up = {};
  itens.forEach((it) => { up[`logsAcesso/${push(ref(db, "logsAcesso")).key}`] = { ...it, ip }; });
  const login = itens.find((i) => i.tipo === "login");
  if (login) {
    up[`usuarios/${login.uid}/email`] = login.email;
    up[`usuarios/${login.uid}/ultimoAcesso`] = serverTimestamp();
  }
  await update(ref(db), up);
  return true;
}

/* ---------- fila (cliques, páginas, seleções) ---------- */
let fila = [], timer = null;

export function registrarEvento(tipo, extra = {}) {
  const user = auth.currentUser;
  if (!user) return;
  if (fila.length >= 200) fila.shift();
  fila.push(montar(tipo, extra, user));
  if (!timer) timer = setTimeout(descarregarFila, 5000);
}

export async function descarregarFila() {
  clearTimeout(timer); timer = null;
  const itens = fila.splice(0);
  try { await gravar(itens); } catch (e) { console.error("[logs-acesso] erro ao gravar fila:", e); }
}

/* ---------- registro imediato (login, logout, cadastro) ---------- */
export async function registrarLog(tipo, extra = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    clearTimeout(timer); timer = null;
    const pendentes = fila.splice(0);           // leva junto o que ainda estava na fila
    return await gravar([...pendentes, montar(tipo, extra, user)]);
  } catch (e) {
    console.error("[logs-acesso] erro ao gravar:", e);
    return false;
  }
}
