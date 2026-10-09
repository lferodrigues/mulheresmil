/* Proteção da página de inscrição: sem login próprio -> login.html (nunca admin.html) */
import { auth } from "./firebase-config-inscricao.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

document.documentElement.style.visibility = "hidden";

(async () => {
  try { await auth.authStateReady(); } catch (e) { console.error(e); }
  if (!auth.currentUser) location.replace("login.html");
  else document.documentElement.style.visibility = "";
})();

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnSair");
  if (b) b.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    location.replace("login.html");
  });
});
