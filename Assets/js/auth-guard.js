/* Proteção de página via Firebase Auth (v2 - com diagnóstico no console). */
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

console.log("[auth-guard v2] carregado em", location.pathname);
document.documentElement.style.visibility = "hidden";

(async () => {
  try {
    await auth.authStateReady();          // espera o Firebase restaurar a sessão
  } catch (e) {
    console.error("[auth-guard] erro ao restaurar sessão:", e);
  }
  const user = auth.currentUser;
  console.log("[auth-guard] usuário:", user ? user.email : "NENHUM");
  if (!user) {
    location.replace("admin.html");
  } else {
    document.documentElement.style.visibility = "";
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnSair");
  if (b) b.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    location.replace("admin.html");
  });
});
