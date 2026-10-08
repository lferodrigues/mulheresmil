/* Alunas — módulo compartilhado (Realtime Database)
   Todas as telas leem as alunas do mesmo lugar:
     alunas/{curso}/{nº da chamada} = { curso, nome, chamada, whatsapp, origem, criadoEm, atualizadoEm }
   Quem usa: Cadastro de Alunas, Lançamento de Frequência, Gerar Lista de Presença,
   Reserva de Livros, sino de atrasos (WhatsApp) e Importar Alunas.

   vincularAluna() é o ÚNICO jeito de incluir/atualizar uma aluna a partir de um cadastro:
   - se já existe aluna com o mesmo nome no curso, só atualiza o WhatsApp (mantém o nº);
   - se não existe, cria com o próximo nº da chamada do curso.
   A gravação é feita em transação, então duas pessoas cadastrando ao mesmo tempo
   não recebem o mesmo número.

   sincronizarInscricoes() traz para alunas/{curso} quem foi inscrita em inscricao.html
   (inscricoes/{cpf}) e ainda não está na lista do curso — inclusive inscrições antigas,
   feitas antes deste vínculo existir. */
import { ref, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export const ALUNAS_PATH = "alunas";

// "  Maria  da Conceição " -> "maria da conceicao" (para comparar nomes)
export function chaveNome(nome) {
  return String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

// Deixa o nome com espaços simples, sem mudar maiúsculas/minúsculas digitadas
export function limparNome(nome) {
  return String(nome || "").replace(/\s+/g, " ").trim();
}

// "32999998888" -> "(32) 99999-8888"
export function formatarWhatsapp(texto) {
  const v = String(texto || "").replace(/\D/g, "").slice(0, 11);
  const d = v.replace(/^(\d{2})(\d)/, "($1) $2");
  return v.length <= 10 ? d.replace(/(\d{4})(\d)/, "$1-$2") : d.replace(/(\d{5})(\d)/, "$1-$2");
}

// Procura a aluna pelo nome dentro da lista de um curso ({ nº: aluna })
export function acharPorNome(porChamada, nome) {
  const alvo = chaveNome(nome);
  if (!alvo) return null;
  for (const [chave, a] of Object.entries(porChamada || {})) {
    if (a && chaveNome(a.nome) === alvo) return { ...a, chamada: Number(a.chamada ?? chave) };
  }
  return null;
}

// Próximo nº da chamada livre no curso
export function proximaChamada(porChamada) {
  let maior = 0;
  for (const [chave, a] of Object.entries(porChamada || {})) {
    const n = Number(a?.chamada ?? chave);
    if (Number.isFinite(n) && n > maior) maior = n;
  }
  return maior + 1;
}

/**
 * Inclui ou atualiza a aluna no curso.
 * @param db  instância do Realtime Database (painel ou inscrição)
 * @param dados { curso, nome, whatsapp, origem }  origem: "cadastro" | "inscricao" | ...
 * @returns { situacao: "nova" | "atualizada" | "sem-mudanca", chamada, nome }
 */
export async function vincularAluna(db, { curso, nome, whatsapp = "", origem = "cadastro", soPreencherZap = false }) {
  curso = String(curso || "").trim();
  nome = limparNome(nome);
  whatsapp = whatsapp ? formatarWhatsapp(whatsapp) : "";
  if (!curso) throw new Error("Curso não informado.");
  if (!nome) throw new Error("Nome não informado.");

  let resultado = null;
  const agora = new Date().toISOString();

  await runTransaction(ref(db, `${ALUNAS_PATH}/${curso}`), (atual) => {
    const lista = atual || {};
    const existente = acharPorNome(lista, nome);

    if (existente) {
      const chave = String(existente.chamada);
      // soPreencherZap: só grava o WhatsApp se a aluna ainda não tiver um (não sobrescreve correções manuais)
      const mudaZap = whatsapp && whatsapp !== (existente.whatsapp || "") && !(soPreencherZap && existente.whatsapp);
      resultado = { situacao: mudaZap ? "atualizada" : "sem-mudanca", chamada: existente.chamada, nome: existente.nome };
      if (!mudaZap) return;                       // nada
