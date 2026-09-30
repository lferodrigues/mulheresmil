/* Proteção de página: só libera quem estiver logado no Firebase Auth. */
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

document.documentElement.style.visibility = "hidden";

onAuthStateChanged(auth, (user) => {
  if (!user) location.replace("admin.html");
  else document.documentElement.style.visibility = "";
});

// Botão opcional com id="btnSair"
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnSair");
  if (b) b.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    location.replace("admin.html");
  });
});
