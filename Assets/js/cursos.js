/* Cursos — módulo compartilhado (Realtime Database: cursos/{id} = { id, nome, criadoEm })
   Os dois cursos antigos continuam existindo como "padrão", mesmo sem estar no banco. */
import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export const CURSOS_PADRAO = {
  assistente: "Assistente Escolar",
  operadora: "Operadora de Computador"
};

// "Auxiliar de Biblioteca" -> "auxiliar-de-biblioteca" (serve como chave no banco)
export function gerarId(nome) {
  return String(nome || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Retorna { id: nome } com os cadastrados no banco (+ os padrão, se incluirPadrao for true)
export async function carregarCursos(incluirPadrao = true, banco = db) {
  const resultado = incluirPadrao ? { ...CURSOS_PADRAO } : {};
  try {
    const snap = await get(ref(banco, "cursos"));
    Object.entries(snap.val() || {}).forEach(([id, c]) => {
      if (c && c.nome) resultado[id] = String(c.nome);
    });
  } catch (e) {
    console.error("[cursos] erro ao ler cursos:", e);
  }
  return resultado;
}
