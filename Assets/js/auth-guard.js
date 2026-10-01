/* Proteção de página: só libera quem estiver autenticado no Firebase Auth. */
import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Esconde a página até o Firebase terminar de restaurar a sessão.
document.documentElement.style.visibility = "hidden";

async function protegerPagina() {
  try {
    // Aguarda explicitamente a inicialização do estado de autenticação.
    // Isso evita o falso "não logado" durante a navegação entre páginas.
    await auth.authStateReady();

    if (!auth.currentUser) {
      const destino = window.location.pathname.split("/").pop() || "painel.html";
      const retorno = encodeURIComponent(destino + window.location.search + window.location.hash);
      window.location.replace("admin.html?returnTo=" + retorno);
      return;
    }

    document.documentElement.style.visibility = "";
  } catch (erro) {
    console.error("Erro ao verificar autenticação:", erro);
    window.location.replace("admin.html");
  }
}

protegerPagina();

// Botão opcional com id="btnSair".
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnSair");
  if (!b) return;

  b.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
    } finally {
      window.location.replace("admin.html");
    }
  });
});
