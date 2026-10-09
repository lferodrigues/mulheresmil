/* Cadastro de Alunas (Firebase Realtime Database)
   - aluna já na lista do curso: pesquisa, escolhe e informa/atualiza o WhatsApp;
   - aluna nova: informa nome + WhatsApp; recebe o próximo nº da chamada do curso.
   Tudo é gravado em alunas/{curso}/{nº} (Assets/js/alunas.js), o mesmo lugar lido pela
   Frequência, Gerar Lista de Presença, Reserva de Livros e o sino de atrasos.
   Ao abrir, traz também quem foi inscrita em inscricao.html e ainda não está na lista. */
import { db } from "./firebase-config.js";
import { ref, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { carregarCursos } from "./cursos.js";
import { ALUNAS_PATH, vincularAluna, acharPorNome, proximaChamada, formatarWhatsapp, limparNome, chaveNome, sincronizarInscricoes, levantarDadosDaAluna, removerAlunaCompleta } from "./alunas.js";

let curso = "";
let cursos = {};            // { id: nome }
let porChamada = {};        // alunas/{curso} como está no banco (tempo real)
let alunas = [];            // [{ nome, chamada, whatsapp }] ordenadas pelo nº
let atual = null;           // aluna existente escolhida
let modoNova = false;       // cadastrando aluna nova?
let paraRemover = null;
let pararEscuta = null;
const $ = (id) => document.getElementById(id);

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nomeDoCurso = () => cursos[curso] || "";
const whatsappDigitado = () => $("whatsapp").value.trim();
const whatsappValido = () => whatsappDigitado().replace(/\D/g, "").length >= 10;
const nomeNovo = () => limparNome($("nomeNovo").value);

function msgErro(e, acao) {
  console.error(e);
  const m = String(e?.code || e?.message || "").toUpperCase();
  return m.includes("PERMISSION")
    ? `Sem permissão para ${acao} no banco de dados. Verifique o login e as regras do Realtime Database.`
    : `Não foi possível ${acao}. Verifique a conexão e tente novamente.`;
}

/* ---------- cursos ---------- */
async function montarCursos() {
  const sel = $("curso");
  cursos = await carregarCursos(false);   // só os cursos cadastrados no banco
  const ordenados = Object.entries(cursos).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  sel.innerHTML = ordenados.length
    ? '<option value="">Selecione</option>' + ordenados.map(([id, nome]) => `<option value="${esc(id)}">${esc(nome)}</option>`).join("")
    : '<option value="">Nenhum curso cadastrado</option>';
}

/* ---------- alunas do curso (tempo real) ---------- */
function aoTrocarCurso() {
  if (pararEscuta) { pararEscuta(); pararEscuta = null; }
  curso = $("curso").value;
  porChamada = {}; alunas = [];
  limpar();
  $("area").hidden = !curso;
  $("areaFicha").hidden = !curso;
  $("cadastros").hidden = true;
  if (!curso) return;
  $("status").textContent = "Carregando alunas...";

  pararEscuta = onValue(ref(db, `${ALUNAS_PATH}/${curso}`), (snap) => {
    porChamada = snap.val() || {};
    alunas = Object.entries(porChamada)
      .filter(([, a]) => a && a.nome)
      .map(([chave, a]) => ({ nome: String(a.nome), chamada: Number(a.chamada ?? chave), whatsapp: a.whatsapp || "" }))
      .sort((a, b) => a.chamada - b.chamada);
    $("status").textContent = alunas.length
      ? `${alunas.length} aluna(s) neste curso.`
      : "Nenhuma aluna neste curso ainda. Cadastre uma nova aluna ou importe a lista de uma planilha.";
    if (modoNova) atualizarNova();
    preencher();
    render();
  }, (e) => { $("status").textContent = msgErro(e, "carregar as alunas"); });
}

/* ---------- pesquisa ---------- */
function preencher() {
  const texto = $("pesquisa").value.trim();
  const busca = chaveNome(texto);
  const sugestoes = $("listaSugestoes");
  sugestoes.innerHTML = "";
  if (!busca || atual || modoNova) { sugestoes.hidden = true; return; }

  const encontradas = alunas.filter((a) => chaveNome(a.nome).includes(busca)).slice(0, 30);
  encontradas.forEach((a) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sugestao-aluna";
    b.innerHTML = `<strong>${esc(a.nome)}</strong><span>Chamada ${a.chamada}${a.whatsapp ? "" : " · sem WhatsApp"}</span>`;
    b.onclick = () => selecionar(a.chamada);
    sugestoes.appendChild(b);
  });
  if (!encontradas.length) {
    sugestoes.insertAdjacentHTML("beforeend", '<div class="sem-resultado">Nenhuma aluna encontrada neste curso.</div>');
  }
  // oferece cadastrar como nova, se o nome digitado não for exatamente de alguém da lista
  if (texto.length >= 3 && !acharPorNome(porChamada, texto)) {
    const nova = document.createElement("button");
    nova.type = "button"; nova.className = "sugestao-nova";
    nova.textContent = `＋ Cadastrar “${limparNome(texto)}” como nova aluna`;
    nova.onclick = () => abrirNova(texto);
    sugestoes.appendChild(nova);
  }
  sugestoes.hidden = false;
}

/* ---------- aluna existente ---------- */
function selecionar(chamada) {
  const a = alunas.find((x) => x.chamada === Number(chamada));
  if (!a) return limpar();
  modoNova = false; atual = a;
  $("novaAluna").hidden = true;
  $("pesquisa").value = a.nome;
  $("listaSugestoes").hidden = true;
  $("dados").hidden = $("campoZap").hidden = false;
  $("nome").textContent = a.nome;
  $("numero").textContent = a.chamada;
  $("whatsapp").value = a.whatsapp;
  $("whatsapp").focus();
  atualizarBotoes();
}

/* ---------- aluna nova ---------- */
function abrirNova(nomeSugerido = "") {
  if (!curso) return;
  atual = null; modoNova = true;
  $("listaSugestoes").hidden = true;
  $("dados").hidden = true;
  $("novaAluna").hidden = false;
  $("campoZap").hidden = false;
  $("nomeNovo").value = limparNome(nomeSugerido);
  $("whatsapp").value = "";
  atualizarNova();
  ($("nomeNovo").value ? $("whatsapp") : $("nomeNovo")).focus();
}

function atualizarNova() {
  $("numeroNovo").textContent = proximaChamada(porChamada);
  const igual = nomeNovo() && acharPorNome(porChamada, nomeNovo());
  $("avisoNome").textContent = igual
    ? `Já existe “${igual.nome}” neste curso (chamada ${igual.chamada}). Ao salvar, só o WhatsApp dela será atualizado.`
    : "";
  atualizarBotoes();
}

function atualizarBotoes() {
  const temAluna = modoNova ? nomeNovo().length >= 3 : !!atual;
  $("salvar").disabled = !temAluna || !whatsappValido();
  $("apagar").disabled = !(atual || modoNova || $("pesquisa").value);
}

function limpar() {
  atual = null; modoNova = false;
  $("pesquisa").value = ""; $("whatsapp").value = ""; $("nomeNovo").value = "";
  $("avisoNome").textContent = "";
  $("dados").hidden = $("campoZap").hidden = $("novaAluna").hidden = true;
  $("listaSugestoes").innerHTML = ""; $("listaSugestoes").hidden = true;
  $("salvar").disabled = true; $("apagar").disabled = true;
}

/* ---------- confirmação ---------- */
function abrirModal({ icone, titulo, texto, botao, acao, aluna }) {
  $("modalIcon").textContent = icone;
  $("modalTitulo").textContent = titulo;
  $("modalTexto").textContent = texto;
  $("modalCurso").textContent = nomeDoCurso();
  $("modalNome").textContent = aluna.nome;
  $("modalChamada").textContent = aluna.chamada;
  $("modalWhatsapp").textContent = aluna.whatsapp || "Não informado";
  $("modalData").hidden = false;
  $("modalApagar").hidden = true; $("modalApagar").innerHTML = "";
  $("modalSalvar").textContent = botao;
  $("modalSalvar").dataset.acao = acao;
  // vermelho para remover, verde para salvar
  $("modalIcon").className = "modal-icon" + (acao === "remover" ? " perigo" : "");
  $("modalSalvar").className = "btn " + (acao === "remover" ? "btn-excluir" : "btn-primaria");
  $("modalSalvar").disabled = false;
  $("modal").hidden = false;
}
function fecharModal() { paraRemover = null; $("modal").hidden = true; }

function salvar() {
  if ($("salvar").disabled) return;
  paraRemover = null;
  if (modoNova) {
    const igual = acharPorNome(porChamada, nomeNovo());
    abrirModal({
      icone: "✓",
      titulo: igual ? "Atualizar WhatsApp" : "Cadastrar nova aluna",
      texto: igual
        ? "Esta aluna já está no curso. Confirme para atualizar o WhatsApp dela:"
        : "Confira os dados. A aluna passa a aparecer na frequência, na lista de presença e na biblioteca:",
      botao: igual ? "Atualizar WhatsApp" : "Cadastrar aluna",
      acao: "salvar",
      aluna: { nome: igual ? igual.nome : nomeNovo(), chamada: igual ? igual.chamada : `${proximaChamada(porChamada)} (automático)`, whatsapp: whatsappDigitado() }
    });
  } else if (atual) {
    abrirModal({
      icone: "✓", titulo: "Confirmar cadastro",
      texto: "Confira os dados da aluna e confirme se deseja salvar:",
      botao: "Salvar cadastro", acao: "salvar",
      aluna: { ...atual, whatsapp: whatsappDigitado() }
    });
  }
}

async function confirmarSalvar() {
  const acao = $("modalSalvar").dataset.acao;
  if (acao === "remover") return confirmarRemocao();
  $("modalSalvar").disabled = true;
  try {
    if (modoNova) {
      const r = await vincularAluna(db, { curso, nome: nomeNovo(), whatsapp: whatsappDigitado(), origem: "cadastro" });
      fecharModal(); limpar();
      $("status").textContent = r.situacao === "nova"
        ? `${r.nome} cadastrada no curso com o nº ${r.chamada}.`
        : `WhatsApp de ${r.nome} atualizado.`;
    } else if (atual) {
      const nome = atual.nome;
      await update(ref(db, `${ALUNAS_PATH}/${curso}/${atual.chamada}`), {
        curso, nome, chamada: atual.chamada,
        whatsapp: formatarWhatsapp(whatsappDigitado()),
        atualizadoEm: new Date().toISOString()
      });
      fecharModal(); limpar();
      $("status").textContent = `Cadastro de ${nome} salvo.`;
    }
  } catch (e) {
    $("modalSalvar").disabled = false;
    $("modalTexto").textContent = msgErro(e, "salvar");
  }
}

/* ---------- remover (apaga TUDO da aluna no banco) ---------- */
const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

async function pedirRemocao(chamada) {
  const a = alunas.find((x) => String(x.chamada) === String(chamada));
  if (!a) return;
  paraRemover = a;
  abrirModal({
    icone: "🗑️", titulo: "Remover aluna e todos os dados",
    texto: "Verificando os dados desta aluna no banco…",
    botao: "Sim, apagar tudo", acao: "remover", aluna: a
  });
  $("modalSalvar").disabled = true;

  try {
    const { resumo } = await levantarDadosDaAluna(db, curso, a, cursos);
    if (paraRemover !== a) return; // o pop-up foi fechado ou trocou de aluna enquanto carregava
    if (resumo.comLivro) {
      $("modalTexto").textContent = "Esta aluna ainda está com " + plural(resumo.comLivro, "livro emprestado", "livros emprestados") +
        ". Registre a devolução em 'Devolução de Livros' antes de remover.";
      return; // botão continua desativado
    }
    $("modalTexto").textContent = "Isto apaga do banco de dados tudo o que pertence a esta aluna neste curso. Esta ação não pode ser desfeita.";
    const itens = [
      "Cadastro no curso (nome, nº da chamada e WhatsApp)",
      resumo.inscricoes
        ? "Ficha de inscrição completa — dados pessoais, socioeconômicos, bancários e documentos"
        : "Ficha de inscrição — nenhuma encontrada",
      resumo.presencas
        ? "Presenças e faltas em " + plural(resumo.presencas, "lista de chamada", "listas de chamada")
        : "Presenças e faltas — nenhuma registrada",
      resumo.emprestimos
        ? "Histórico da biblioteca: " + plural(resumo.emprestimos, "empréstimo devolvido", "empréstimos devolvidos")
        : "Histórico da biblioteca — nenhum empréstimo"
    ];
    $("modalApagar").innerHTML = '<strong>Será apagado:</strong><ul>' +
      itens.map((t) => `<li class="${/nenhum/.test(t) ? "vazio-item" : ""}">${esc(t)}</li>`).join("") + "</ul>";
    $("modalApagar").hidden = false;
    $("modalSalvar").disabled = false;
  } catch (e) {
    $("modalTexto").textContent = msgErro(e, "remover");
  }
}

async function confirmarRemocao() {
  if (!paraRemover) return;
  const a = paraRemover;
  $("modalSalvar").disabled = true;
  $("modalSalvar").textContent = "Apagando…";
  try {
    const r = await removerAlunaCompleta(db, curso, a, cursos);
    if (atual && atual.chamada === a.chamada) limpar();
    fecharModal();
    const partes = ["cadastro no curso"];
    if (r.inscricoes) partes.push("ficha de inscrição");
    if (r.presencas) partes.push("presenças em " + plural(r.presencas, "lista", "listas"));
    if (r.emprestimos) partes.push(plural(r.emprestimos, "empréstimo", "empréstimos") + " no histórico");
    $("status").textContent = `${a.nome} removida. Apagado do banco: ${partes.join(", ")}.`;
  } catch (e) {
    $("modalSalvar").textContent = "Sim, apagar tudo";
    if (e && e.code === "COM_LIVRO") {
      $("modalTexto").textContent = "Esta aluna acabou de pegar um livro emprestado. Registre a devolução antes de remover.";
      $("modalApagar").hidden = true;
      return;
    }
    $("modalSalvar").disabled = false;
    $("modalTexto").textContent = msgErro(e, "remover");
  }
}

/* ---------- lista do curso ---------- */
function render() {
  $("cadastros").hidden = !alunas.length;
  $("contador").textContent = alunas.length;
  const semZap = alunas.filter((a) => !a.whatsapp).length;
  $("semZap").textContent = semZap ? `${semZap} sem WhatsApp — pesquise o nome acima para completar.` : "";
  $("lista").innerHTML = alunas.map((a) =>
    `<tr><td class="col-num">${esc(a.chamada)}</td><td><strong>${esc(a.nome)}</strong></td>` +
    `<td>${a.whatsapp ? `<span class="phone">${esc(a.whatsapp)}</span>` : `<span class="tag sem">Sem WhatsApp</span>`}</td>` +
    `<td class="centro"><button type="button" class="btn btn-perigo btn-mini remover-aluna" data-chamada="${esc(a.chamada)}">` +
    `<svg class="i"><use href="#i-lixo"/></svg>Remover</button></td></tr>`
  ).join("");
}

/* ---------- eventos ---------- */
$("curso").onchange = aoTrocarCurso;
$("pesquisa").oninput = () => {
  if (atual || modoNova) { atual = null; modoNova = false; $("dados").hidden = $("campoZap").hidden = $("novaAluna").hidden = true; }
  preencher(); atualizarBotoes();
};
$("btnNova").onclick = () => abrirNova($("pesquisa").value && !acharPorNome(porChamada, $("pesquisa").value) ? $("pesquisa").value : "");
$("nomeNovo").oninput = atualizarNova;
$("whatsapp").oninput = () => { $("whatsapp").value = formatarWhatsapp($("whatsapp").value); atualizarBotoes(); };
$("salvar").onclick = salvar;
$("apagar").onclick = limpar;
$("modalVoltar").onclick = fecharModal;
$("modalSalvar").onclick = confirmarSalvar;
$("lista").addEventListener("click", (e) => {
  const b = e.target.closest(".remover-aluna");
  if (b) pedirRemocao(b.dataset.chamada);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".campo-pesquisa")) $("listaSugestoes").hidden = true;
});

/* ---------- início: cursos + inscrições feitas em inscricao.html ---------- */
let avisoInscricoes = "";
async function iniciar() {
  try {
    await montarCursos();
  } catch (e) {
    console.error(e);
    $("curso").innerHTML = '<option value="">Erro ao carregar cursos</option>';
    return;
  }
  try {
    const r = await sincronizarInscricoes(db, cursos);
    const partes = [];
    if (r.novas) partes.push(`${r.novas} aluna(s) incluída(s) a partir das inscrições`);
    if (r.atualizadas) partes.push(`${r.atualizadas} WhatsApp(s) completado(s) pelas inscrições`);
    if (r.semCurso) partes.push(`${r.semCurso} inscrição(ões) com curso que não está cadastrado`);
    avisoInscricoes = partes.join(" · ");
    if (avisoInscricoes) mostrarAvisoInscricoes();
  } catch (e) {
    console.error("[cadastro] sincronizar inscrições:", e);
    avisoInscricoes = msgErro(e, "ler as inscrições");
    mostrarAvisoInscricoes();
  }
}
function mostrarAvisoInscricoes() {
  const el = $("avisoInscricoes");
  if (el) { el.textContent = avisoInscricoes; el.hidden = !avisoInscricoes; }
}

iniciar();
