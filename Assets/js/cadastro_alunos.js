/* Cadastro de Alunas — Biblioteca Itinerante (Firebase Realtime Database) */
import { db } from "./firebase-config.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const ALUNAS_PATH = "alunas";
const CURSOS = {
  assistente: ["lista_presenca_assistente_escolar.html", "Assistente Escolar"],
  operadora: ["lista_presenca_mulheres_mil.html", "Operadora de Computador"]
};

let alunas = [], curso = "", atual = null;
let cadastradas = [];      // cadastros exibidos na lista do curso atual
let paraRemover = null;    // cadastro aguardando confirmação de remoção
const $ = id => document.getElementById(id);

function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function normalizar(t){ return t.trim().toLocaleLowerCase("pt-BR"); }
function nomeDoCurso(){ return CURSOS[curso]?.[1] || ""; }
function whatsappDigitado(){ return $("whatsapp").value.trim(); }

function formatarWhatsapp(texto){
  const v = texto.replace(/\D/g,"").slice(0,11);
  const d = v.replace(/^(\d{2})(\d)/,"($1) $2");
  return v.length<=10 ? d.replace(/(\d{4})(\d)/,"$1-$2") : d.replace(/(\d{5})(\d)/,"$1-$2");
}

async function carregar(arquivo){
  const resposta = await fetch(arquivo,{cache:"no-store"});
  const texto = await resposta.text();
  const match = texto.match(/(?:const|let|var)\s+ALUNAS\s*=\s*(\[[\s\S]*?\]);/);
  if(!resposta.ok || !match) throw Error("Lista não encontrada");
  return Function("return "+match[1])().map((nome,i)=>({nome,chamada:i+1}));
}

async function buscarCadastros(){
  const snap = await get(ref(db,ALUNAS_PATH));
  return snap.exists() ? (snap.val() || {}) : {};
}

async function aoTrocarCurso(){
  curso = $("curso").value;
  limpar();
  $("area").hidden = !curso;
  if(!curso) return;
  $("status").textContent = "Carregando lista...";
  try{
    alunas = await carregar(CURSOS[curso][0]);
    $("status").textContent = alunas.length+" alunas carregadas.";
    preencher();
    await render();
  }catch(e){
    console.error(e);
    $("status").textContent = "Não foi possível carregar a lista de presença.";
  }
}

function preencher(){
  const busca = normalizar($("pesquisa").value), sugestoes = $("listaSugestoes");
  sugestoes.innerHTML = "";
  if(!busca){ sugestoes.hidden = true; return; }
  const encontradas = alunas.filter(a => a.nome.toLocaleLowerCase("pt-BR").includes(busca));
  if(!encontradas.length){
    sugestoes.innerHTML = '<div class="sem-resultado">Nenhuma aluna encontrada.</div>';
    sugestoes.hidden = false; return;
  }
  encontradas.forEach(a => {
    const botao = document.createElement("button");
    botao.type = "button"; botao.className = "sugestao-aluna";
    botao.innerHTML = `<strong>${esc(a.nome)}</strong><span>Chamada ${a.chamada}</span>`;
    botao.onclick = () => selecionar(alunas.indexOf(a));
    sugestoes.appendChild(botao);
  });
  sugestoes.hidden = false;
}

async function selecionar(indice){
  if(!alunas[indice]) return limpar();
  atual = alunas[indice];
  $("pesquisa").value = atual.nome;
  $("listaSugestoes").hidden = true;
  $("dados").hidden = $("campoZap").hidden = false;
  $("nome").textContent = atual.nome;
  $("numero").textContent = atual.chamada;
  try{
    const snap = await get(ref(db,`${ALUNAS_PATH}/${curso}/${atual.chamada}`));
    $("whatsapp").value = snap.exists() ? (snap.val()?.whatsapp || "") : "";
  }catch(e){ console.error(e); $("whatsapp").value = ""; }
  atualizarBotoes();
}

function atualizarBotoes(){
  $("salvar").disabled = !atual || !whatsappDigitado();
  $("apagar").disabled = false;
}

function limpar(){
  atual = null; $("pesquisa").value = ""; $("whatsapp").value = "";
  $("dados").hidden = $("campoZap").hidden = true;
  $("salvar").disabled = true; $("apagar").disabled = false;
  $("listaSugestoes").innerHTML = ""; $("listaSugestoes").hidden = true;
}

function voltarInicio(){
  curso = ""; atual = null; alunas = []; cadastradas = []; paraRemover = null;
  $("curso").value = ""; $("area").hidden = true; $("pesquisa").value = "";
  $("whatsapp").value = ""; $("dados").hidden = true; $("campoZap").hidden = true;
  $("salvar").disabled = true; $("apagar").disabled = false;
  $("listaSugestoes").innerHTML = ""; $("listaSugestoes").hidden = true; $("cadastros").hidden = true;
}

function fecharModal(){ paraRemover = null; $("modal").hidden = true; }

function salvar(){
  if(!atual || !whatsappDigitado()) return;
  paraRemover = null;
  $("modalIcon").textContent = "✓"; $("modalTitulo").textContent = "Confirmar cadastro";
  $("modalTexto").textContent = "Confira os dados da aluna e confirme se deseja realmente salvar:";
  $("modalCurso").textContent = nomeDoCurso(); $("modalNome").textContent = atual.nome;
  $("modalChamada").textContent = atual.chamada; $("modalWhatsapp").textContent = whatsappDigitado();
  $("modalData").hidden = false; $("modalSalvar").textContent = "Salvar cadastro";
  $("modalSalvar").dataset.acao = "salvar"; $("modal").hidden = false;
}

function apagar(){
  paraRemover = null;
  $("modalIcon").textContent = "!"; $("modalTitulo").textContent = "Voltar para o início?";
  $("modalTexto").textContent = "Você está prestes a sair desta etapa do cadastro. Os dados já salvos não serão apagados.";
  $("modalCurso").textContent = nomeDoCurso(); $("modalNome").textContent = atual ? atual.nome : "";
  $("modalChamada").textContent = atual ? atual.chamada : ""; $("modalWhatsapp").textContent = whatsappDigitado() || "Não informado";
  $("modalData").hidden = false; $("modalSalvar").textContent = "Confirmar e voltar";
  $("modalSalvar").dataset.acao = "voltar"; $("modal").hidden = false;
}

/* ---------- remover cadastro de aluna ---------- */
function pedirRemocao(chamada){
  const cadastro = cadastradas.find(x => String(x.chamada) === String(chamada));
  if(!cadastro) return;
  paraRemover = cadastro;
  $("modalIcon").textContent = "🗑️"; $("modalTitulo").textContent = "Remover cadastro";
  $("modalTexto").textContent = "Deseja realmente remover o cadastro desta aluna? Esta ação não pode ser desfeita.";
  $("modalCurso").textContent = nomeDoCurso(); $("modalNome").textContent = cadastro.nome;
  $("modalChamada").textContent = cadastro.chamada; $("modalWhatsapp").textContent = cadastro.whatsapp || "Não informado";
  $("modalData").hidden = false; $("modalSalvar").textContent = "Sim, remover";
  $("modalSalvar").dataset.acao = "remover"; $("modal").hidden = false;
}

async function confirmarRemocao(){
  if(!paraRemover) return;
  const cadastro = paraRemover;
  $("modalSalvar").disabled = true;
  try{
    // Não permite remover aluna que ainda está com livro emprestado
    const snap = await get(ref(db,"emprestimos"));
    const emprestimos = Object.values(snap.val() || {});
    const comLivro = emprestimos.some(e =>
      e && e.status === "emprestado" &&
      e.alunaCurso === curso && String(e.alunaChamada) === String(cadastro.chamada));
    if(comLivro){
      $("modalTexto").textContent = "Esta aluna ainda está com livro(s) emprestado(s). Registre a devolução em 'Devolução de Livros' antes de remover o cadastro.";
      $("modalSalvar").disabled = false;
      return;
    }

    await remove(ref(db,`${ALUNAS_PATH}/${curso}/${cadastro.chamada}`));
    $("modalSalvar").disabled = false;
    if(atual && String(atual.chamada) === String(cadastro.chamada)) limpar();
    fecharModal();
    await render();
    $("status").textContent = "Cadastro de " + cadastro.nome + " removido.";
  }catch(e){
    console.error(e);
    $("modalSalvar").disabled = false;
    $("modalTexto").textContent = `Não foi possível remover no Firebase. Erro: ${e?.code||e?.message||"desconhecido"}. Verifique as regras do Realtime Database e se você está logado.`;
  }
}

async function confirmarSalvar(){
  const acao = $("modalSalvar").dataset.acao;
  if(acao === "remover"){ return confirmarRemocao(); }
  if(acao === "voltar"){ fecharModal(); voltarInicio(); return; }
  if(!atual || !whatsappDigitado()) return;
  const cadastro = {
    curso, nome: atual.nome, chamada: atual.chamada,
    whatsapp: whatsappDigitado(), atualizadoEm: new Date().toISOString()
  };
  try{
    $("modalSalvar").disabled = true;
    await set(ref(db,`${ALUNAS_PATH}/${curso}/${atual.chamada}`), cadastro);
    $("modalSalvar").disabled = false;
    fecharModal(); voltarInicio();
    $("status").textContent = "Cadastro salvo no Firebase.";
  }catch(e){
    console.error(e);
    $("modalSalvar").disabled = false;
    $("modalTexto").textContent = `Não foi possível salvar no Firebase. Erro: ${e?.code||e?.message||"desconhecido"}. Verifique as regras do Realtime Database e se você está logado.`;
  }
}

async function render(){
  try{
    const dados = await buscarCadastros();
    cadastradas = Object.values(dados?.[curso] || {}).sort((a,b) => Number(a.chamada) - Number(b.chamada));
    $("cadastros").hidden = !cadastradas.length;
    $("contador").textContent = cadastradas.length;
    $("lista").innerHTML = cadastradas.map(x =>
      `<div><b class="num">${esc(x.chamada)}</b><span><strong>${esc(x.nome)}</strong><br><small>${esc(nomeDoCurso())}</small></span><b class="phone">${esc(x.whatsapp)}</b><button type="button" class="remover-aluna" data-chamada="${esc(x.chamada)}">Remover</button></div>`
    ).join("");
  }catch(e){ console.error(e); }
}

$("curso").onchange = aoTrocarCurso;
$("pesquisa").oninput = preencher;
$("whatsapp").oninput = () => { $("whatsapp").value = formatarWhatsapp($("whatsapp").value); atualizarBotoes(); };
$("salvar").onclick = salvar; $("apagar").onclick = apagar;
$("modalVoltar").onclick = fecharModal; $("modalSalvar").onclick = confirmarSalvar;
$("lista").addEventListener("click", e => {
  const b = e.target.closest(".remover-aluna");
  if(b) pedirRemocao(b.dataset.chamada);
});
