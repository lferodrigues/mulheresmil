/* =========================================================
   Cadastro de Alunas — Biblioteca Itinerante
   Firebase Realtime Database
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2Kz1hwQM8HplqtIPM6GMBS-X-aroExg0w",
  authDomain: "biblioteca-virtual-8db41.firebaseapp.com",
  projectId: "biblioteca-virtual-8db41",
  storageBucket: "biblioteca-virtual-8db41.firebasestorage.app",
  messagingSenderId: "247188034497",
  appId: "1:247188034497:web:29d31ef65693d5d85e5540",
  measurementId: "G-6F9T86KGZ3"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ALUNAS_PATH = "alunas";

const CURSOS = {
  assistente: ["lista_presenca_assistente_escolar.html", "Assistente Escolar"],
  operadora: ["lista_presenca_mulheres_mil.html", "Operadora de Computador"]
};

let alunas = [], curso = "", atual = null;
const $ = id => document.getElementById(id);

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function normalizar(texto){ return texto.trim().toLocaleLowerCase("pt-BR"); }
function nomeDoCurso(){ return CURSOS[curso]?.[1] || ""; }
function whatsappDigitado(){ return $("whatsapp").value.trim(); }

function formatarWhatsapp(texto){
  const v=texto.replace(/\D/g,"").slice(0,11);
  const d=v.replace(/^(\d{2})(\d)/,"($1) $2");
  return v.length<=10 ? d.replace(/(\d{4})(\d)/,"$1-$2") : d.replace(/(\d{5})(\d)/,"$1-$2");
}

async function carregar(arquivo){
  const resposta=await fetch(arquivo,{cache:"no-store"});
  const texto=await resposta.text();
  const match=texto.match(/(?:const|let|var)\s+ALUNAS\s*=\s*(\[[\s\S]*?\]);/);
  if(!resposta.ok || !match) throw Error();
  return Function("return "+match[1])().map((nome,i)=>({nome,chamada:i+1}));
}

async function buscarCadastros(){
  const snap=await get(ref(db,ALUNAS_PATH));
  if(!snap.exists()) return {};
  return snap.val() || {};
}

async function aoTrocarCurso(){
  curso=$("curso").value;
  limpar();
  $("area").hidden=!curso;
  if(!curso)return;
  $("status").textContent="Carregando lista...";
  try{
    alunas=await carregar(CURSOS[curso][0]);
    $("status").textContent=alunas.length+" alunas carregadas.";
    preencher();
    await render();
  }catch(e){
    console.error(e);
    $("status").textContent="Não foi possível carregar a lista de presença.";
  }
}

function preencher(){
  const busca=normalizar($("pesquisa").value), sugestoes=$("listaSugestoes");
  sugestoes.innerHTML="";
  if(!busca){sugestoes.hidden=true;return;}
  const encontradas=alunas.filter(a=>a.nome.toLocaleLowerCase("pt-BR").includes(busca));
  if(!encontradas.length){
    sugestoes.innerHTML='<div class="sem-resultado">Nenhuma aluna encontrada.</div>';
    sugestoes.hidden=false; return;
  }
  encontradas.forEach(a=>{
    const botao=document.createElement("button");
    botao.type="button"; botao.className="sugestao-aluna";
    botao.innerHTML=`<strong>${esc(a.nome)}</strong><span>Chamada ${a.chamada}</span>`;
    botao.onclick=()=>selecionar(alunas.indexOf(a));
    sugestoes.appendChild(botao);
  });
  sugestoes.hidden=false;
}

async function selecionar(indice){
  if(!alunas[indice])return limpar();
  atual=alunas[indice];
  $("pesquisa").value=atual.nome;
  $("listaSugestoes").hidden=true;
  $("dados").hidden=$("campoZap").hidden=false;
  $("nome").textContent=atual.nome;
  $("numero").textContent=atual.chamada;
  try{
    const snap=await get(ref(db,`${ALUNAS_PATH}/${curso}/${atual.chamada}`));
    const cadastro=snap.exists()?snap.val():null;
    $("whatsapp").value=cadastro?.whatsapp||"";
  }catch(e){console.error(e);$("whatsapp").value="";}
  atualizarBotoes();
}

function atualizarBotoes(){
  $("salvar").disabled=!atual||!whatsappDigitado();
  $("apagar").disabled=false;
}

function limpar(){
  atual=null;$("pesquisa").value="";$("whatsapp").value="";
  $("dados").hidden=$("campoZap").hidden=true;
  $("salvar").disabled=true;$("apagar").disabled=false;
  $("listaSugestoes").innerHTML="";$("listaSugestoes").hidden=true;
}

function voltarInicio(){
  curso="";atual=null;alunas=[];
  $("curso").value="";$("area").hidden=true;$("pesquisa").value="";
  $("whatsapp").value="";$("dados").hidden=true;$("campoZap").hidden=true;
  $("salvar").disabled=true;$("apagar").disabled=false;
  $("listaSugestoes").innerHTML="";$("listaSugestoes").hidden=true;$("cadastros").hidden=true;
}

function fecharModal(){$("modal").hidden=true;}

function salvar(){
  if(!atual||!whatsappDigitado())return;
  $("modalIcon").textContent="✓";$("modalTitulo").textContent="Confirmar cadastro";
  $("modalTexto").textContent="Confira os dados da aluna e confirme se deseja realmente salvar:";
  $("modalCurso").textContent=nomeDoCurso();$("modalNome").textContent=atual.nome;
  $("modalChamada").textContent=atual.chamada;$("modalWhatsapp").textContent=whatsappDigitado();
  $("modalData").hidden=false;$("modalSalvar").textContent="Salvar cadastro";
  $("modalSalvar").dataset.acao="salvar";$("modal").hidden=false;
}

function apagar(){
  $("modalIcon").textContent="!";$("modalTitulo").textContent="Voltar para o início?";
  $("modalTexto").textContent="Você está prestes a sair desta etapa do cadastro. Os dados já salvos não serão apagados.";
  $("modalCurso").textContent=nomeDoCurso();$("modalNome").textContent=atual?atual.nome:"";
  $("modalChamada").textContent=atual?atual.chamada:"";$("modalWhatsapp").textContent=whatsappDigitado()||"Não informado";
  $("modalData").hidden=false;$("modalSalvar").textContent="Confirmar e voltar";
  $("modalSalvar").dataset.acao="voltar";$("modal").hidden=false;
}

async function confirmarSalvar(){
  if($("modalSalvar").dataset.acao==="voltar"){fecharModal();voltarInicio();return;}
  if(!atual||!whatsappDigitado())return;
  const cadastro={
    curso,nome:atual.nome,chamada:atual.chamada,
    whatsapp:whatsappDigitado(),
    atualizadoEm:new Date().toISOString()
  };
  try{
    $("modalSalvar").disabled=true;
    await set(ref(db,`${ALUNAS_PATH}/${curso}/${atual.chamada}`),cadastro);
    fecharModal(); voltarInicio();
    $("status").textContent="Cadastro salvo no Firebase.";
  }catch(e){
    console.error(e);
    $("modalSalvar").disabled=false;
    $("modalTexto").textContent="Não foi possível salvar no Firebase. Verifique as regras do Realtime Database.";
  }
}

async function render(){
  try{
    const dados=await buscarCadastros();
    const cadastradas=Object.values(dados?.[curso]||{}).sort((a,b)=>Number(a.chamada)-Number(b.chamada));
    $("cadastros").hidden=!cadastradas.length;
    $("contador").textContent=cadastradas.length;
    $("lista").innerHTML=cadastradas.map(x=>`<div><b class="num">${esc(x.chamada)}</b><span><strong>${esc(x.nome)}</strong><br><small>${esc(nomeDoCurso())}</small></span><b class="phone">${esc(x.whatsapp)}</b></div>`).join("");
  }catch(e){console.error(e);}
}

$("curso").onchange=aoTrocarCurso;
$("pesquisa").oninput=preencher;
$("whatsapp").oninput=()=>{$("whatsapp").value=formatarWhatsapp($("whatsapp").value);atualizarBotoes();};
$("salvar").onclick=salvar;$("apagar").onclick=apagar;
$("modalVoltar").onclick=fecharModal;$("modalSalvar").onclick=confirmarSalvar;
