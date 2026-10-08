/* Layout do painel administrativo: menu lateral, busca, nome do usuário.
   Usado em painel.html e biblioteca.html. */
import { auth, db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

/* ---------- menu lateral ---------- */

const body = document.body;
const mobile = () => window.matchMedia("(max-width:860px)").matches;
const grupos = [...document.querySelectorAll(".group")];

try { if (localStorage.getItem("mm_menu_fechado") === "1") body.classList.add("side-off"); } catch (e) {}
const salvar = (v) => { try { localStorage.setItem("mm_menu_fechado", v ? "1" : "0"); } catch (e) {} };

document.getElementById("btnFechar").onclick = () => {
  if (mobile()) body.classList.remove("side-on");
  else { body.classList.add("side-off"); salvar(true); }
};
document.getElementById("btnMenu").onclick = () => {
  if (mobile()) body.classList.add("side-on");
  else { body.classList.remove("side-off"); salvar(false); }
};
document.getElementById("overlay").onclick = () => body.classList.remove("side-on");
document.addEventListener("keydown", (e) => { if (e.key === "Escape") body.classList.remove("side-on"); });

grupos.forEach((g) => g.querySelector(".group-btn").onclick = () => g.classList.toggle("open"));
document.getElementById("btnExpandir").onclick = () => grupos.forEach((g) => g.classList.add("open"));
document.getElementById("btnRecolher").onclick = () => grupos.forEach((g) => g.classList.remove("open"));

// busca no menu
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
document.getElementById("busca").addEventListener("input", (e) => {
  const q = norm(e.target.value.trim());
  let achou = 0;
  grupos.forEach((g) => {
    const titulo = norm(g.querySelector(".group-btn").textContent);
    let n = 0;
    g.querySelectorAll(".sub a").forEach((a) => {
      const ok = !q || titulo.includes(q) || norm(a.textContent).includes(q);
      a.style.display = ok ? "" : "none";
      if (ok) n++;
    });
    g.style.display = n ? "" : "none";
    g.classList.toggle("open", !!q && n > 0);
    achou += n;
  });
  const inicio = document.querySelector(".nav-link");
  const inicioOk = !q || norm(inicio.textContent).includes(q);
  inicio.style.display = inicioOk ? "" : "none";
  document.getElementById("navVazio").style.display = (achou || inicioOk) ? "none" : "block";
});

/* ---------- sino de atrasos (notificacoes.js) dentro do topo ---------- */
const topo = document.querySelector(".top-right");
function encaixarSino() {
  const sino = document.querySelector("body > .sino-wrap");
  if (sino && topo) { topo.insertBefore(sino, topo.firstChild); return true; }
  return false;
}
if (!encaixarSino()) {
  const obs = new MutationObserver(() => { if (encaixarSino()) obs.disconnect(); });
  obs.observe(document.body, { childList: true });
}

/* ---------- nome do usuário logado ---------- */
(async () => {
  await auth.authStateReady();
  const u = auth.currentUser;
  if (!u) return;
  let nome = "";
  try { nome = ((await get(ref(db, "usuarios/" + u.uid))).val() || {}).nome || ""; } catch (e) {}
  const el = document.getElementById("userName");
  if (!el) return;
  el.textContent = "Olá, ";
  const b = document.createElement("b");
  b.textContent = nome || (u.email || "").split("@")[0];
  el.appendChild(b);
})();
