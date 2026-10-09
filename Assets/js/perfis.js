/* Perfis de acesso dos usuários — perfis/{uid} no Realtime Database.
     "administrador" (ou sem perfil gravado) -> acesso a tudo (painel + inscrição);
     "cadastro"                              -> só a Inscrição de Alunas (login.html).
   O perfil fica FORA de usuarios/{uid} de propósito: cada usuário pode gravar o próprio
   usuarios/{uid}, então guardar o perfil ali permitiria que ele se promovesse sozinho. */
import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export const PERFIS = {
  cadastro: { rotulo: "Perfil de cadastro", curto: "Cadastro" },
  administrador: { rotulo: "Administrador", curto: "Administrador" }
};

export const normalizarPerfil = (p) => (p === "cadastro" ? "cadastro" : "administrador");

/* Lê o perfil de um usuário. Se a leitura falhar (ex.: regras de "perfis" ainda não
   publicadas), devolve "administrador" e avisa no console, para nunca trancar todo
   mundo fora do painel. */
export async function obterPerfil(uid) {
  try {
    const snap = await get(ref(db, "perfis/" + uid + "/perfil"));
    return normalizarPerfil(snap.val());
  } catch (e) {
    console.warn("[perfis] não foi possível ler o perfil (confira as regras de 'perfis'):", e);
    return "administrador";
  }
}
