/* Inscrição de Alunas — Programa Mulheres Mil (Firebase Realtime Database)
   Grava em: inscricoes/{CPF só com números}
     { identificacao, inscricao, pessoais, domicilio, programa, bancarios, documentos, criadoEm, criadoPor }
   - o CPF é a chave: não permite duas inscrições da mesma pessoa (pede confirmação para atualizar);
   - NÃO guarda cópia de documentos (a aluna entrega o xerox em papel): só os números de RG, CPF e NIS
     e a conferência de quais documentos foram entregues. */
import { auth, db } from "./firebase-config-inscricao.js";
import { ref, get, set, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { carregarCursos } from "./cursos.js";

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const limparTxt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/* ---------- definição do formulário (baseada no Anexo I do edital) ---------- */
const T = (id, label, o = {}) => ({ k: "t", id, label, ...o });
const S = (id, label, opts, o = {}) => ({ k: "s", id, label, opts, ...o });
const R = (id, label, opts, sub) => ({ k: "r", id, label, opts, sub });
const C = (id, label, opts) => ({ k: "c", id, label, opts });

const SECOES = [
  { key: "identificacao", titulo: "1. Identificação e contato", campos: [
    T("nome", "Nome completo", { req: 1, full: 1 }),
    T("nascimento", "Data de nascimento", { type: "date", req: 1 }),
    T("whatsapp", "WhatsApp / telefone", { type: "tel", mask: "tel", ph: "(32) 99999-9999", max: 15, req: 1 }),
    T("cpf", "CPF", { mask: "cpf", ph: "000.000.000-00", max: 14, req: 1 }),
    T("rg", "RG (número)", { req: 1, max: 20 }),
    T("nis", "Cadastro Único (NIS)", { mask: "num", max: 11, ph: "Somente números" }),
    T("email", "E-mail (opcional)", { type: "email" })
  ]},
  { key: "inscricao", titulo: "2. Curso desejado", campos: [
    S("curso", "Em qual curso a aluna deseja se inscrever?", [], { req: 1, full: 1 })
  ]},
  { key: "pessoais", titulo: "3. Dados gerais e socioeconômicos", campos: [
    T("naturalidade", "Onde você nasceu (cidade/estado)?"),
    T("endereco", "Onde você mora (endereço completo)", { req: 1, full: 1 }),
    R("area", "Em que área você mora?", ["Zona urbana", "Zona rural"]),
    R("localizacao", "Onde sua casa está localizada?", ["Bairro", "Comunidade quilombola", "Assentamento"]),
    R("genero", "Qual sua identidade de gênero?", ["Mulher Cis", "Mulher Trans", "Não binário", "Travesti", "Prefere não declarar", "Não sei informar"]),
    R("cor", "Qual sua cor/etnia?", ["Branca", "Indígena", "Parda", "Preta", "Outra", "Prefere não declarar"]),
    R("estadoCivil", "Qual seu estado civil?", ["Solteira", "Casada", "Separada/Divorciada/Desquitada", "União Estável", "Viúva"]),
    R("filhos", "Quantos filhos você tem?", ["Nenhum", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Mais de Seis"]),
    R("religiao", "Qual a sua religião?", ["Católica", "Religião afro-brasileira: umbanda, candomblé", "Espírita Kardecista", "Protestante ou Evangélica", "Não tenho religião", "Prefere não declarar", "Outra"]),
    R("escolaridade", "Qual o seu nível de escolaridade?", ["Sem escolaridade/analfabeta", "Apenas Alfabetizada: leio e escrevo", "Fundamental Incompleto", "Fundamental Completo", "Ensino Médio Incompleto", "Ensino Médio Completo", "Ensino Superior Incompleto", "Ensino Superior Completo"]),
    T("ultimaEscola", "Qual o nome da última escola que estudou?", { full: 1 }),
    R("deficiencia", "Possui alguma deficiência?", ["Não", "Sim"], { when: "Sim", id: "deficienciaQual", label: "Qual?" }),
    R("doencaCronica", "Você tem alguma doença crônica?", ["Não", "Sim"], { when: "Sim", id: "doencaCronicaQual", label: "Qual?" }),
    R("medicamento", "Toma algum medicamento de uso contínuo?", ["Não", "Sim"], { when: "Sim", id: "medicamentoQual", label: "Qual?" }),
    R("drogasDomicilio", "Alguém em sua casa/domicílio e/ou comunidade fez ou faz uso de droga/entorpecente?", ["Não", "Sim"])
  ]},
  { key: "domicilio", titulo: "4. Dados gerais estatísticos", campos: [
    R("moradia", "Você mora em uma casa/domicílio:", ["Próprio", "Alugado", "Emprestado", "Outros"]),
    C("domicilioTem", "O seu domicílio tem:", ["Água encanada", "Esgoto", "Luz Elétrica", "Gás encanado", "Serviços de coleta de lixo"]),
    C("servicosBairro", "No seu bairro, sua família tem acesso a que tipo de serviços?", ["Unidade Básica de Saúde", "Escola", "Creche", "CRAS", "Associação do bairro", "Biblioteca pública", "Atividades Culturais", "ONGS", "Área de lazer", "Outros"]),
    C("itensCasa", "Marque os itens que você possui em sua casa/domicílio:", ["Aparelho de som", "Televisão", "DVD", "Geladeira", "Rádio", "Freezer independente", "Máquina de lavar roupa", "Computador", "Acesso à internet", "Impressora", "Telefone fixo", "Telefone celular", "TV por assinatura", "Automóvel", "Motocicleta"]),
    R("atividadeRemunerada", "Você exerce alguma atividade remunerada?", ["Não", "Sim"]),
    C("fonteRenda", "Qual a sua fonte de renda?", ["Emprego fixo próprio", "Vive com benefícios sociais do governo", "Diarista", "Ambulante (emprego informal)", "Autônoma (por conta própria)", "Trabalhadora temporária", "Dona de negócio", "Pensionista", "Aposentada", "Outra"]),
    R("participacaoRenda", "Qual a sua participação na renda da sua família?", ["Não trabalho e sou sustentada pela família ou por outras pessoas", "Trabalho, mas recebo ajuda financeira da família ou de outras pessoas", "Trabalho, sou responsável pelo meu próprio sustento", "Trabalho, sou responsável pelo meu sustento e contribuo para o sustento da minha família", "Trabalho e sou a principal responsável pelo sustento da minha família"]),
    T("profissao", "Qual sua profissão/onde trabalha?", { full: 1 }),
    R("outrasExperiencias", "Você possui outras experiências profissionais?", ["Não", "Sim"], { when: "Sim", id: "outrasExperienciasDescricao", label: "Descreva essas experiências", area: 1 }),
    R("rendaFamiliar", "Qual a renda total familiar (em salários mínimos)?", ["Até 3 salários mínimos", "2 salários mínimos", "1 salário mínimo", "Menos que um salário mínimo", "Apenas Bolsa Família"]),
    R("quemContribui", "Quem é a pessoa que mais contribui na renda total da sua família?", ["Você mesma", "Cônjuge/Companheiro(a)", "Seus pais", "Seus filhos(as)", "Outra"]),
    C("beneficios", "Quais benefícios você recebe?", ["Bolsa Família", "Outros derivados do Bolsa Família", "Não recebo"]),
    R("pessoasCasa", "Quantas pessoas moram na sua casa/domicílio?", ["Um", "Dois", "Três", "Quatro", "Cinco", "Mais de cinco"]),
    T("qtdFilhos", "Quantos filhos você tem?", { type: "number", min: 0, max: 30 }),
    T("idadeFilhos", "Qual a idade dos seus filhos?"),
    C("atendimentoMedico", "Quando você e/ou sua família precisam de atendimento médico, utilizam:", ["SUS", "Plano de Saúde", "Médico particular", "Outros"]),
    C("transporte", "Qual é o meio de transporte que você mais utiliza?", ["Carro próprio", "Carro da família", "Moto", "Bicicleta", "Ônibus", "Táxi/Lotação", "Outros"])
  ]},
  { key: "programa", titulo: "5. Dados referentes ao Programa Mulheres Mil", campos: [
    R("jaFezCurso", "Você já fez ou está frequentando algum curso profissionalizante?", ["Não", "Sim"], { when: "Sim", id: "jaFezCursoQuais", label: "Qual(is) curso(s) você já fez?" }),
    C("porqueEscolheu", "Por que escolheu esse curso no Programa Mulheres Mil?", ["Era o curso que eu desejava fazer", "Preparar-me para o mercado de trabalho", "Proporciona bom salário", "Já trabalho na área", "Não há outra instituição oferecendo", "Pelo horário", "Ser gratuito", "Ter uma profissão", "Influência de parentes/amigos", "Outros"]),
    R("familiaImpede", "Alguém da sua família tenta impedir/proibir a sua participação no Programa?", ["Não", "Sim"]),
    C("quemAjudou", "O que ou quem ajudou você a tomar a decisão de ingressar no Programa?", ["A credibilidade da instituição ofertante", "Meus(minhas) amigos(as)", "Informações gerais (revistas, jornais, TV)", "Facilidade de obter emprego", "Lideranças da minha comunidade", "Estímulo financeiro", "Receber uma qualificação profissional", "Convite e informações dos gestores locais", "Outras"]),
    R("decisaoCertificacao", "Qual a principal decisão que você vai tomar quando obtiver a certificação?", ["Continuar meus estudos", "Procurar emprego", "Prestar vestibular e continuar a trabalhar", "Fazer mais curso(s) profissionalizante(s)", "Trabalhar por conta própria/em meu próprio negócio", "Criar uma cooperativa/associação com minhas colegas", "Ainda não decidi"]),
    { k: "a", id: "sonhos", label: "Quais seus sonhos e desejos como resultado da participação no Programa?", full: 1 },
    R("situacaoRisco", "Você considera que vive alguma situação de risco? (violência doméstica, deficiência, situação de rua, violência de gênero etc.)", ["Sim", "Não"])
  ]},
  { key: "bancarios", titulo: "6. Dados bancários para depósito", dica: "A conta deve estar no nome da própria aluna.", campos: [
    T("titular", "Nome do titular da conta", { req: 1, full: 1 }),
    T("banco", "Banco", { req: 1, ph: "Ex.: Caixa Econômica Federal" }),
    S("tipoConta", "Tipo de conta", ["Conta corrente", "Conta poupança", "Poupança social digital"], { req: 1 }),
    T("agencia", "Agência (com dígito, se houver)", { req: 1, max: 10 }),
    T("conta", "Conta (com dígito)", { req: 1, max: 20 }),
    T("pix", "Chave PIX (opcional)", { full: 1 })
  ]},
  { key: "documentos", titulo: "7. Conferência da documentação física", dica: "Apenas marque o que a aluna entregou em papel (xerox). Nada é anexado ao sistema.", campos: [
    C("entregues", "Documentos entregues:", ["Histórico Escolar do Ensino Fundamental I ou autodeclaração (Anexo IV)", "Documento de identidade com foto", "CPF", "Comprovante de residência atualizado", "Cadastro Único (NIS)", "Declaração de renda (Anexo III)"])
  ]}
];

/* ---------- desenho do formulário ---------- */
const ehOutro = (o) => /^outr/i.test(o);

function htmlCampo(f) {
  if (f.k === "t") {
    return `<label class="${f.full ? "full" : ""}"><span class="${f.req ? "req" : ""}">${esc(f.label)}</span>` +
      `<input id="${f.id}" type="${f.type || "text"}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} ${f.max && f.type !== "number" ? `maxlength="${f.max}"` : ""} ` +
      `${f.min !== undefined ? `min="${f.min}" max="${f.max}"` : ""} autocomplete="off" ${f.mask ? `data-mask="${f.mask}"` : ""}></label>`;
  }
  if (f.k === "s") {
    return `<label class="${f.full ? "full" : ""}"><span class="${f.req ? "req" : ""}">${esc(f.label)}</span>` +
      `<select id="${f.id}"><option value="">Selecione</option>${f.opts.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
  }
  if (f.k === "a") {
    return `<label class="${f.full ? "full" : ""}">${esc(f.label)}<textarea id="${f.id}" maxlength="600"></textarea></label>`;
  }
  const tipo = f.k === "r" ? "radio" : "checkbox";
  const ops = f.opts.map((o) =>
    `<label class="op"><input type="${tipo}" name="${f.id}" value="${esc(o)}">${esc(o)}` +
    `${ehOutro(o) ? `<input type="text" class="outro" data-outro="${f.id}" placeholder="Qual?" maxlength="80">` : ""}</label>`).join("");
  const sub = f.sub
    ? `<label class="sub" id="sub_${f.sub.id}" hidden>${esc(f.sub.label)}` +
      (f.sub.area ? `<textarea id="${f.sub.id}" maxlength="400"></textarea>` : `<input type="text" id="${f.sub.id}" maxlength="150">`) + `</label>`
    : "";
  return `<fieldset class="grupo full" data-g="${f.id}"><legend>${esc(f.label)}</legend><div class="opcoes">${ops}</div>${sub}</fieldset>`;
}

$("form").innerHTML = SECOES.map((s) =>
  `<section class="secao"><h2>${esc(s.titulo)}</h2>${s.dica ? `<p class="dica">${esc(s.dica)}</p>` : ""}` +
  `<div class="grade">${s.campos.map(htmlCampo).join("")}</div></section>`).join("");

/* ---------- máscaras e campos condicionais ---------- */
const soNum = (v) => String(v || "").replace(/\D/g, "");
const MASCARAS = {
  num: (v) => soNum(v).slice(0, 11),
  cpf: (v) => soNum(v).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2"),
  tel: (v) => {
    const d = soNum(v).slice(0, 11), p = d.replace(/^(\d{2})(\d)/, "($1) $2");
    return d.length <= 10 ? p.replace(/(\d{4})(\d)/, "$1-$2") : p.replace(/(\d{5})(\d)/, "$1-$2");
  }
};
$("form").addEventListener("input", (e) => {
  const m = e.target.dataset && e.target.dataset.mask;
  if (m) e.target.value = MASCARAS[m](e.target.value);
  e.target.classList.remove("invalido");
});
$("form").addEventListener("change", (e) => {
  const g = e.target.closest && e.target.closest("fieldset[data-g]");
  if (!g) return;
  for (const s of SECOES) for (const f of s.campos) {
    if (f.id === g.dataset.g && f.sub) {
      const marcado = g.querySelector("input:checked");
      $("sub_" + f.sub.id).hidden = !(marcado && marcado.value === f.sub.when);
    }
  }
  g.classList.remove("invalido");
});
$("nascimento").max = new Date().toISOString().slice(0, 10);

/* ---------- cursos (vêm do banco) ---------- */
let CURSOS = {};
carregarCursos(true, db).then((c) => {
  CURSOS = c;
  const ids = Object.keys(c).sort((a, b) => c[a].localeCompare(c[b], "pt-BR"));
  $("curso").innerHTML = '<option value="">Selecione o curso</option>' +
    ids.map((id) => `<option value="${esc(id)}">${esc(c[id])}</option>`).join("");
}).catch((e) => { console.error(e); $("curso").innerHTML = '<option value="">Erro ao carregar cursos</option>'; });

/* ---------- leitura e validação ---------- */
function validarCpf(cpf) {
  const d = soNum(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += +d[i] * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== +d[t]) return false;
  }
  return true;
}

function coletar() {
  const dados = {};
  SECOES.forEach((s) => {
    const o = (dados[s.key] = {});
    s.campos.forEach((f) => {
      if (f.k === "t" || f.k === "s" || f.k === "a") { o[f.id] = limparTxt($(f.id).value); return; }
      const marcados = [...document.querySelectorAll(`input[name="${f.id}"]:checked`)].map((i) => i.value);
      o[f.id] = f.k === "r" ? (marcados[0] || "") : marcados;
      const outro = document.querySelector(`input[data-outro="${f.id}"]`);
      if (outro) o[f.id + "Outro"] = marcados.some(ehOutro) ? limparTxt(outro.value) : "";
      if (f.sub) o[f.sub.id] = marcados[0] === f.sub.when ? limparTxt($(f.sub.id).value) : "";
    });
  });
  return dados;
}

function msg(t, tipo) { $("status").textContent = t || ""; $("status").className = tipo || ""; }

function validar() {
  document.querySelectorAll(".invalido").forEach((e) => e.classList.remove("invalido"));
  let primeiro = null;
  const marcar = (el) => { el.classList.add("invalido"); primeiro = primeiro || el; };
  SECOES.forEach((s) => s.campos.forEach((f) => { if (f.req && !limparTxt($(f.id).value)) marcar($(f.id)); }));
  if (primeiro) { primeiro.focus(); msg("Preencha os campos obrigatórios (*).", "erro"); return false; }
  if (!validarCpf($("cpf").value)) { marcar($("cpf")); $("cpf").focus(); msg("CPF inválido. Confira os números.", "erro"); return false; }
  const dig = soNum($("whatsapp").value);
  if (dig.length < 10) { marcar($("whatsapp")); $("whatsapp").focus(); msg("Informe um WhatsApp/telefone válido com DDD.", "erro"); return false; }
  const nasc = new Date($("nascimento").value);
  if (isNaN(nasc) || nasc > new Date()) { marcar($("nascimento")); $("nascimento").focus(); msg("Data de nascimento inválida.", "erro"); return false; }
  const email = limparTxt($("email").value);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { marcar($("email")); $("email").focus(); msg("E-mail inválido.", "erro"); return false; }
  msg("");
  return true;
}

/* ---------- confirmação e gravação ---------- */
let pendente = null;   // { id, dados, existe }

function erro(e) {
  console.error(e);
  const m = String((e && (e.code || e.message)) || "").toUpperCase();
  msg(m.includes("PERMISSION")
    ? "Sem permissão no banco de dados. Confira o login e as regras do nó 'inscricoes' no Realtime Database."
    : "Não foi possível concluir a operação. Verifique a conexão e tente novamente.", "erro");
}
const fecharModal = () => { pendente = null; $("modal").hidden = true; };

async function pedirSalvar() {
  if (!validar()) return;
  const dados = coletar();
  const id = soNum(dados.identificacao.cpf);
  $("salvar").disabled = true;
  let existe = false;
  try { existe = (await get(ref(db, "inscricoes/" + id))).exists(); }
  catch (e) { $("salvar").disabled = false; return erro(e); }
  $("salvar").disabled = false;

  pendente = { id, dados, existe };
  const i = dados.identificacao, b = dados.bancarios;
  $("modalIcon").textContent = existe ? "!" : "✓";
  $("modalTitulo").textContent = existe ? "Atualizar inscrição" : "Confirmar inscrição";
  $("modalTexto").textContent = existe
    ? "Já existe uma inscrição com este CPF. Os dados serão substituídos pelos do formulário."
    : "Confira os dados principais antes de salvar:";
  const linhas = [
    ["Nome", i.nome], ["CPF", i.cpf], ["RG", i.rg], ["WhatsApp", i.whatsapp],
    ["Curso", CURSOS[dados.inscricao.curso] || dados.inscricao.curso],
    ["Dados bancários", `${b.banco} · ${b.tipoConta} · Ag. ${b.agencia} · Conta ${b.conta}`],
    ["Titular da conta", b.titular],
    ["Documentos entregues", `${dados.documentos.entregues.length} de 6`]
  ];
  $("modalResumo").innerHTML = linhas.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");
  $("modalConfirmar").textContent = existe ? "Confirmar e atualizar" : "Confirmar e salvar";
  $("modal").hidden = false;
}

async function confirmarSalvar() {
  if (!pendente) return;
  const { id, dados, existe } = pendente;
  const btn = $("modalConfirmar");
  btn.disabled = true;
  try {
    const registro = {
      ...dados,
      inscricao: { curso: dados.inscricao.curso, cursoNome: CURSOS[dados.inscricao.curso] || "" },
      atualizadoEm: serverTimestamp(),
      atualizadoPor: (auth.currentUser && auth.currentUser.email) || ""
    };
    if (!existe) {
      registro.criadoEm = serverTimestamp();
      registro.criadoPor = registro.atualizadoPor;
    } else {
      const antigo = (await get(ref(db, `inscricoes/${id}/criadoEm`))).val();
      if (antigo) registro.criadoEm = antigo;
      registro.criadoPor = (await get(ref(db, `inscricoes/${id}/criadoPor`))).val() || registro.atualizadoPor;
    }
    await set(ref(db, "inscricoes/" + id), registro);
    const nome = dados.identificacao.nome;
    fecharModal();
    limparForm();
    msg(`Inscrição de ${nome} ${existe ? "atualizada" : "salva"} no banco de dados.`, "ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) { fecharModal(); erro(e); }
  finally { btn.disabled = false; }
}

function limparForm() {
  document.querySelectorAll("#form input, #form select, #form textarea").forEach((el) => {
    if (el.type === "radio" || el.type === "checkbox") el.checked = false; else el.value = "";
    el.classList.remove("invalido");
  });
  document.querySelectorAll(".sub").forEach((s) => { s.hidden = true; });
}

/* ---------- lista de inscrições ---------- */
onValue(ref(db, "inscricoes"), (snap) => {
  const lista = Object.entries(snap.val() || {})
    .map(([id, v]) => ({ id, nome: v?.identificacao?.nome || "", curso: v?.inscricao?.cursoNome || v?.inscricao?.curso || "" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  $("contador").textContent = lista.length;
  $("inscritas").hidden = !lista.length;
  $("lista").innerHTML = lista.map((x) =>
    `<div><span><strong>${esc(x.nome)}</strong><small>${esc(x.curso)}</small></span>` +
    `<span class="cpf">CPF ***.${esc(x.id.slice(3, 6))}.${esc(x.id.slice(6, 9))}-**</span></div>`).join("");
}, (e) => console.error("[inscricoes] erro ao ler:", e));

/* ---------- eventos ---------- */
$("salvar").onclick = pedirSalvar;
$("limpar").onclick = () => { if (confirm("Limpar todos os campos do formulário?")) { limparForm(); msg(""); } };
$("modalVoltar").onclick = fecharModal;
$("modalConfirmar").onclick = confirmarSalvar;
$("form").addEventListener("submit", (e) => e.preventDefault());
