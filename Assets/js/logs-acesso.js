/* Logs de acesso — grava em logsAcesso/{id} (Realtime Database).
   Tipos usados: "login", "logout", "cadastro".
   Nunca lança erro: se falhar, apenas registra no console e devolve false. */
import { auth, db } from "./firebase-config.js";
import { ref, push, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export async function registrarLog(tipo, extra = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const novo = push(ref(db, "logsAcesso"));
    const up = {};
    up[`logsAcesso/${novo.key}`] = {
      uid: user.uid,
      email: user.email || "",
      tipo,
      pagina: location.pathname.split("/").pop() || "index.html",
      data: serverTimestamp(),
      navegador: String(navigator.userAgent || "").slice(0, 200),
      ...extra
    };

    // Mantém o "último acesso" no cadastro do usuário
    if (tipo === "login") {
      up[`usuarios/${user.uid}/email`] = user.email || "";
      up[`usuarios/${user.uid}/ultimoAcesso`] = serverTimestamp();
    }

    await update(ref(db), up);
    return true;
  } catch (e) {
    console.error("[logs-acesso] erro ao gravar:", e);
    return false;
  }
}
