/* =========================================================
   Cadastro de Alunas — Biblioteca Itinerante (Mulheres Mil)
   ========================================================= */

/* ---------------------------------------------------------
   1. Constantes e estado
   --------------------------------------------------------- */
const STORAGE_KEY = "mm_biblioteca_alunas";

// Para cada curso: [arquivo com a lista de alunas, nome exibido]
const CURSOS = {
  assistente: ["lista_presenca_assistente_escolar.html", "Assistente Escolar"],
  operadora: ["lista_presenca_mulheres_mil.html", "Operadora de Computador"]
};

let alunas = [];    // alunas do curso selecionado
let curso = "";     // curso selecionado
let atual = null;   // aluna selecionada

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------
   2. Utilitários
   --------------------------------------------------------- */

// Escapa caracteres HTML para evitar injeção de código
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function normalizar(texto) {
  return texto.trim().toLocaleLowerCase("pt-BR");
}

function nomeDoCurso() {
  return curso === "assistente" ? "Assistente Escolar" : "Operadora de Computador";
}

function whatsappDigitado() {
  return $("whatsapp").value.trim();
}

// Aplica máscara: (99) 9999-9999 ou (99) 99999-9999
function formatarWhatsapp(texto) {
  const v = texto.replace(/\D/g, "").slice(0, 11);
  const comDdd = v.replace(/^(\d{2})(\d)/, "($1) $2");

  return v.length <= 10
    ? comDdd.replace(/(\d{4})(\d)/, "$1-$2")
    : comDdd.replace(/(\d{5})(\d)/, "$1-$2");
}

/* ---------------------------------------------------------
   3. Armazenamento (localStorage)
   --------------------------------------------------------- */
function get() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function gravar(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/* ---------------------------------------------------------
   4. Carregamento das alunas (a partir da lista de presença)
   --------------------------------------------------------- */

// Lê o arquivo HTML da lista de presença e extrai o array ALUNAS
async function carregar(arquivo) {
  const resposta = await fetch(arquivo, { cache: "no-store" });
  const texto = await resposta.text();
  const match = texto.match(/(?:const|let|var)\s+ALUNAS\s*=\s*(\[[\s\S]*?\]);/);

  if (!resposta.ok || !match) throw Error();

  return Function("return " + match[1])().map((nome, i) => ({
    nome,
    chamada: i + 1
  }));
}

async function aoTrocarCurso() {
  curso = $("curso").value;
  limpar();
  $("area").hidden = !curso;

  if (!curso) return;

  $("status").textContent = "Carregando lista...";

  try {
    alunas = await carregar(CURSOS[curso][0]);
    $("status").textContent = alunas.length + " alunas carregadas.";
    preencher();
    render();
  } catch (e) {
    $("status").textContent = "Não foi possível carregar a lista de presença.";
  }
}

/* ---------------------------------------------------------
   5. Pesquisa e seleção de aluna
   --------------------------------------------------------- */
function criarSugestao(aluna) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "sugestao-aluna";
  botao.innerHTML = `<strong>${esc(aluna.nome)}</strong><span>Chamada ${aluna.chamada}</span>`;
  botao.onclick = () => selecionar(alunas.indexOf(aluna));
  return botao;
}

function preencher() {
  const busca = normalizar($("pesquisa").value);
  const sugestoes = $("listaSugestoes");

  sugestoes.innerHTML = "";

  if (!busca) {
    sugestoes.hidden = true;
    return;
  }

  const encontradas = alunas.filter((a) => a.nome.toLocaleLowerCase("pt-BR").includes(busca));

  if (!encontradas.length) {
    sugestoes.innerHTML = '<div class="sem-resultado">Nenhuma aluna encontrada.</div>';
    sugestoes.hidden = false;
    return;
  }

  encontradas.forEach((aluna) => sugestoes.appendChild(criarSugestao(aluna)));
  sugestoes.hidden = false;
}

function selecionar(indice) {
  if (!alunas[indice]) return limpar();

  atual = alunas[indice];

  $("pesquisa").value = atual.nome;
  $("listaSugestoes").hidden = true;
  $("dados").hidden = $("campoZap").hidden = false;
  $("nome").textContent = atual.nome;
  $("numero").textContent = atual.chamada;

  // Preenche o WhatsApp se a aluna já estiver cadastrada
  const cadastro = get().find((x) => x.curso === curso && x.chamada === atual.chamada);
  $("whatsapp").value = cadastro ? cadastro.whatsapp : "";

  atualizarBotoes();
}

/* ---------------------------------------------------------
   6. Estado do formulário
   --------------------------------------------------------- */
function atualizarBotoes() {
  $("salvar").disabled = !atual || !whatsappDigitado();
  $("apagar").disabled = false;
}

// Limpa a aluna selecionada e os campos relacionados
function limpar() {
  atual = null;
  $("pesquisa").value = "";
  $("whatsapp").value = "";
  $("dados").hidden = $("campoZap").hidden = true;
  $("salvar").disabled = true;
  $("apagar").disabled = false;

  if ($("listaSugestoes")) {
    $("listaSugestoes").innerHTML = "";
    $("listaSugestoes").hidden = true;
  }
}

// Volta a tela ao estado inicial (nenhum curso selecionado)
function voltarInicio() {
  curso = "";
  atual = null;
  alunas = [];

  $("curso").value = "";
  $("area").hidden = true;
  $("pesquisa").value = "";
  $("whatsapp").value = "";
  $("dados").hidden = true;
  $("campoZap").hidden = true;
  $("salvar").disabled = true;
  $("apagar").disabled = false;
  $("listaSugestoes").innerHTML = "";
  $("listaSugestoes").hidden = true;
  $("cadastros").hidden = true;
}

/* ---------------------------------------------------------
   7. Modal
   --------------------------------------------------------- */
function fecharModal() {
  $("modal").hidden = true;
}

// Abre o modal de confirmação de cadastro
function salvar() {
  if (!atual || !whatsappDigitado()) return;

  $("modalIcon").textContent = "✓";
  $("modalTitulo").textContent = "Confirmar cadastro";
  $("modalTexto").textContent = "Confira os dados da aluna e confirme se deseja realmente salvar:";

  $("modalCurso").textContent = nomeDoCurso();
  $("modalNome").textContent = atual.nome;
  $("modalChamada").textContent = atual.chamada;
  $("modalWhatsapp").textContent = whatsappDigitado();
  $("modalData").hidden = false;

  $("modalSalvar").textContent = "Salvar cadastro";
  $("modalSalvar").dataset.acao = "salvar";
  $("modal").hidden = false;
}

// Abre o modal de confirmação para voltar ao início
function apagar() {
  $("modalIcon").textContent = "!";
  $("modalTitulo").textContent = "Voltar para o início?";
  $("modalTexto").textContent = "Você está prestes a sair desta etapa do cadastro. Os dados já salvos não serão apagados.";

  $("modalCurso").textContent = nomeDoCurso();
  $("modalNome").textContent = atual ? atual.nome : "";
  $("modalChamada").textContent = atual ? atual.chamada : "";
  $("modalWhatsapp").textContent = whatsappDigitado() || "Não informado";
  $("modalData").hidden = false;

  $("modalSalvar").textContent = "Confirmar e voltar";
  $("modalSalvar").dataset.acao = "voltar";
  $("modal").hidden = false;
}

// Ação do botão principal do modal (salvar ou voltar, conforme data-acao)
function confirmarSalvar() {
  if ($("modalSalvar").dataset.acao === "voltar") {
    fecharModal();
    voltarInicio();
    return;
  }

  if (!atual || !whatsappDigitado()) return;

  const cadastro = {
    curso: curso,
    nome: atual.nome,
    chamada: atual.chamada,
    whatsapp: whatsappDigitado()
  };

  // Remove cadastro anterior da mesma aluna (se houver) e grava o novo
  const lista = get().filter((x) => !(x.curso === curso && x.chamada === atual.chamada));
  lista.push(cadastro);
  gravar(lista);

  fecharModal();
  voltarInicio();
}

/* ---------------------------------------------------------
   8. Renderização da lista de alunas cadastradas
   --------------------------------------------------------- */
function render() {
  const cadastradas = get()
    .filter((x) => x.curso === curso)
    .sort((a, b) => a.chamada - b.chamada);

  $("cadastros").hidden = !cadastradas.length;
  $("contador").textContent = cadastradas.length;

  $("lista").innerHTML = cadastradas.map((x) => `
    <div>
      <b class="num">${x.chamada}</b>
      <span>
        <strong>${esc(x.nome)}</strong><br>
        <small>${CURSOS[curso][1]}</small>
      </span>
      <b class="phone">${esc(x.whatsapp)}</b>
    </div>
  `).join("");
}

/* ---------------------------------------------------------
   9. Eventos
   --------------------------------------------------------- */
function iniciarEventos() {
  $("curso").onchange = aoTrocarCurso;
  $("pesquisa").oninput = preencher;

  $("whatsapp").oninput = () => {
    $("whatsapp").value = formatarWhatsapp($("whatsapp").value);
    atualizarBotoes();
  };

  $("salvar").onclick = salvar;
  $("apagar").onclick = apagar;
  $("modalVoltar").onclick = fecharModal;
  $("modalSalvar").onclick = confirmarSalvar;
}

/* ---------------------------------------------------------
   10. Inicialização
   --------------------------------------------------------- */
iniciarEventos();
