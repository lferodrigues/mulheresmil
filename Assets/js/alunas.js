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
      if (!mudaZap) return;                       // nada a gravar: aborta sem escrever
      lista[chave] = { ...lista[chave], curso, chamada: existente.chamada, whatsapp, atualizadoEm: agora };
      return lista;
    }

    const chamada = proximaChamada(lista);
    lista[String(chamada)] = { curso, nome, chamada, whatsapp, origem, criadoEm: agora, atualizadoEm: agora };
    resultado = { situacao: "nova", chamada, nome };
    return lista;
  });

  return resultado;
}

/* ---------- inscrições (inscricao.html) -> alunas ---------- */

// Descobre o código do curso da inscrição entre os cursos cadastrados ({ id: nome }).
// Usa o código gravado; se ele não existir mais, compara pelo nome do curso.
export function cursoDaInscricao(inscricao, cursos) {
  const id = String(inscricao?.curso || "").trim();
  if (id && cursos[id]) return id;
  const nomes = [inscricao?.cursoNome, cursos[id], id].map(chaveNome).filter(Boolean);
  for (const [cid, cnome] of Object.entries(cursos)) {
    if (nomes.includes(chaveNome(cnome))) return cid;
  }
  return "";
}

let sincronizando = null;   // evita rodar duas vezes ao mesmo tempo na mesma página

/**
 * Inclui em alunas/{curso} as inscritas que ainda não estão na lista do curso
 * e completa o WhatsApp de quem está sem. Não mexe em quem já tem WhatsApp.
 * Inscrições marcadas com vinculoRemovido (aluna removida no Cadastro de Alunas) são ignoradas.
 * @param db      instância do Realtime Database
 * @param cursos  { id: nome } dos cursos cadastrados (carregarCursos)
 * @returns { novas, atualizadas, semCurso }
 */
export function sincronizarInscricoes(db, cursos) {
  if (!sincronizando) {
    sincronizando = executarSincronizacao(db, cursos || {}).finally(() => { sincronizando = null; });
  }
  return sincronizando;
}

async function executarSincronizacao(db, cursos) {
  const resumo = { novas: 0, atualizadas: 0, semCurso: 0 };
  if (!Object.keys(cursos).length) return resumo;

  const [insSnap, alSnap] = await Promise.all([get(ref(db, "inscricoes")), get(ref(db, ALUNAS_PATH))]);
  const inscricoes = insSnap.val() || {};
  const alunas = alSnap.val() || {};

  const pendentes = [];
  for (const v of Object.values(inscricoes)) {
    const nome = limparNome(v?.identificacao?.nome);
    if (!nome) continue;
    const curso = cursoDaInscricao(v.inscricao, cursos);
    if (!curso) { resumo.semCurso++; continue; }
    if (v.vinculoRemovido && v.vinculoRemovido === curso) continue;
    const zap = v.identificacao?.whatsapp ? formatarWhatsapp(v.identificacao.whatsapp) : "";
    const existente = acharPorNome(alunas[curso], nome);
    if (existente && (existente.whatsapp || !zap)) continue;   // já está completa
    pendentes.push({ curso, nome, whatsapp: zap });
  }

  for (const p of pendentes) {
    const r = await vincularAluna(db, { ...p, origem: "inscricao", soPreencherZap: true });
    if (r?.situacao === "nova") resumo.novas++;
    else if (r?.situacao === "atualizada") resumo.atualizadas++;
  }
  return resumo;
}

/* Ao remover uma aluna do curso, marca as inscrições dela para a sincronização
   não trazê-la de volta. (Se a inscrição for salva de novo em inscricao.html, a marca some.) */
export async function marcarRemocaoNasInscricoes(db, curso, nome, cursos) {
  const alvo = chaveNome(nome);
  const inscricoes = (await get(ref(db, "inscricoes"))).val() || {};
  const mudancas = {};
  for (const [id, v] of Object.entries(inscricoes)) {
    if (chaveNome(v?.identificacao?.nome) === alvo && cursoDaInscricao(v?.inscricao, cursos) === curso) {
      mudancas[`inscricoes/${id}/vinculoRemovido`] = curso;
    }
  }
  if (Object.keys(mudancas).length) await update(ref(db), mudancas);
  return Object.keys(mudancas).length;
}

/* ---------- remoção completa da aluna ---------- */

/**
 * Procura TUDO o que pertence à aluna (curso + nº da chamada + nome) e devolve
 * os caminhos a apagar, sem apagar nada ainda (serve para a pré-visualização).
 *   - alunas/{curso}/{nº}                                   cadastro no curso
 *   - inscricoes/{cpf}                                      ficha de inscrição (mesmo nome e mesmo curso)
 *   - presenca/{curso}/listas/{lista}/presencas/{nº}         presenças e faltas
 *   - emprestimos/{id}                                      histórico de livros (já devolvidos)
 * Se houver livro ainda emprestado com ela, devolve comLivro > 0 (a remoção deve ser bloqueada).
 */
export async function levantarDadosDaAluna(db, curso, aluna, cursos) {
  const chamada = String(aluna.chamada);
  const alvo = chaveNome(aluna.nome);
  const [insSnap, presSnap, empSnap] = await Promise.all([
    get(ref(db, "inscricoes")),
    get(ref(db, `presenca/${curso}/listas`)),
    get(ref(db, "emprestimos"))
  ]);

  const caminhos = [`${ALUNAS_PATH}/${curso}/${chamada}`];
  const resumo = { inscricoes: 0, presencas: 0, emprestimos: 0, comLivro: 0 };

  // ficha de inscrição: mesma aluna (nome) no mesmo curso
  for (const [id, v] of Object.entries(insSnap.val() || {})) {
    if (chaveNome(v?.identificacao?.nome) === alvo && cursoDaInscricao(v?.inscricao, cursos || {}) === curso) {
      caminhos.push(`inscricoes/${id}`);
      resumo.inscricoes++;
    }
  }

  // presenças: o nº da chamada dela em cada lista do curso
  for (const [listaId, l] of Object.entries(presSnap.val() || {})) {
    if (l && l.presencas && Object.prototype.hasOwnProperty.call(l.presencas, chamada)) {
      caminhos.push(`presenca/${curso}/listas/${listaId}/presencas/${chamada}`);
      resumo.presencas++;
    }
  }

  // empréstimos: ativo bloqueia; devolvidos entram na remoção
  for (const [id, e] of Object.entries(empSnap.val() || {})) {
    if (!e || e.alunaCurso !== curso || String(e.alunaChamada) !== chamada) continue;
    if (e.status === "emprestado") resumo.comLivro++;
    else { caminhos.push(`emprestimos/${id}`); resumo.emprestimos++; }
  }

  return { caminhos, resumo };
}

/**
 * Apaga de uma vez (atualização atômica: ou apaga tudo, ou nada) todos os dados da aluna.
 * Confere de novo no momento de apagar. Lança erro "COM_LIVRO" se ela estiver com livro emprestado.
 * @returns resumo { inscricoes, presencas, emprestimos }
 */
export async function removerAlunaCompleta(db, curso, aluna, cursos) {
  const { caminhos, resumo } = await levantarDadosDaAluna(db, curso, aluna, cursos);
  if (resumo.comLivro) {
    const e = new Error("A aluna está com livro emprestado.");
    e.code = "COM_LIVRO";
    throw e;
  }
  const mudancas = {};
  caminhos.forEach((c) => { mudancas[c] = null; });
  await update(ref(db), mudancas);
  return resumo;
}
