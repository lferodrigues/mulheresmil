/* =========================================================
   Exportar inscrições para planilha Excel (.xlsx)
   ---------------------------------------------------------
   Gera um arquivo com TODAS as informações gravadas em
   inscricoes/{cpf} pelo formulário de inscrição:
     identificação, curso, dados socioeconômicos, domicílio,
     programa, dados bancários, documentos e registro.

   Abas do arquivo:
     - "Resumo": cursos e quantidade de inscritas
     - "Todas as inscrições": uma linha por aluna
     - uma aba por curso (quando há mais de um curso)

   Campos que existirem no banco e não estiverem na lista abaixo
   (ex.: um campo novo no formulário) entram automaticamente
   no fim da planilha, para nada ficar de fora.
   Precisa da biblioteca SheetJS (xlsx.full.min.js) na página.
   ========================================================= */

// [seção, campo, título da coluna] — na ordem do formulário de inscrição
const COLUNAS = [
  ["identificacao", "nome", "Nome completo"],
  ["identificacao", "nascimento", "Data de nascimento"],
  ["_calc", "idade", "Idade"],
  ["identificacao", "whatsapp", "WhatsApp / telefone"],
  ["identificacao", "cpf", "CPF"],
  ["identificacao", "rg", "RG"],
  ["identificacao", "nis", "Cadastro Único (NIS)"],
  ["identificacao", "email", "E-mail"],

  ["inscricao", "cursoNome", "Curso"],

  ["pessoais", "naturalidade", "Naturalidade (cidade/estado)"],
  ["pessoais", "endereco", "Endereço completo"],
  ["pessoais", "area", "Área onde mora"],
  ["pessoais", "localizacao", "Localização da casa"],
  ["pessoais", "genero", "Identidade de gênero"],
  ["pessoais", "cor", "Cor/etnia"],
  ["pessoais", "estadoCivil", "Estado civil"],
  ["pessoais", "filhos", "Quantos filhos (faixa)"],
  ["pessoais", "religiao", "Religião"],
  ["pessoais", "escolaridade", "Escolaridade"],
  ["pessoais", "ultimaEscola", "Última escola em que estudou"],
  ["pessoais", "deficiencia", "Possui deficiência?"],
  ["pessoais", "deficienciaQual", "Qual deficiência"],
  ["pessoais", "doencaCronica", "Possui doença crônica?"],
  ["pessoais", "doencaCronicaQual", "Qual doença crônica"],
  ["pessoais", "medicamento", "Medicamento de uso contínuo?"],
  ["pessoais", "medicamentoQual", "Qual medicamento"],
  ["pessoais", "drogasDomicilio", "Uso de drogas no domicílio/comunidade?"],

  ["domicilio", "moradia", "Moradia"],
  ["domicilio", "domicilioTem", "O domicílio tem"],
  ["domicilio", "servicosBairro", "Serviços no bairro"],
  ["domicilio", "itensCasa", "Itens que possui em casa"],
  ["domicilio", "atividadeRemunerada", "Exerce atividade remunerada?"],
  ["domicilio", "fonteRenda", "Fonte de renda"],
  ["domicilio", "participacaoRenda", "Participação na renda da família"],
  ["domicilio", "profissao", "Profissão / onde trabalha"],
  ["domicilio", "outrasExperiencias", "Outras experiências profissionais?"],
  ["domicilio", "outrasExperienciasDescricao", "Descrição das experiências"],
  ["domicilio", "rendaFamiliar", "Renda total familiar"],
  ["domicilio", "quemContribui", "Quem mais contribui na renda"],
  ["domicilio", "beneficios", "Benefícios que recebe"],
  ["domicilio", "pessoasCasa", "Pessoas na casa"],
  ["domicilio", "qtdFilhos", "Quantidade de filhos"],
  ["domicilio", "idadeFilhos", "Idade dos filhos"],
  ["domicilio", "atendimentoMedico", "Atendimento médico"],
  ["domicilio", "transporte", "Meio de transporte"],

  ["programa", "jaFezCurso", "Já fez curso profissionalizante?"],
  ["programa", "jaFezCursoQuais", "Quais cursos já fez"],
  ["programa", "porqueEscolheu", "Por que escolheu o curso"],
  ["programa", "familiaImpede", "Família tenta impedir a participação?"],
  ["programa", "quemAjudou", "O que/quem ajudou na decisão"],
  ["programa", "decisaoCertificacao", "Decisão após a certificação"],
  ["programa", "sonhos", "Sonhos e desejos"],
  ["programa", "situacaoRisco", "Vive situação de risco?"],

  ["bancarios", "titular", "Titular da conta", "banco"],
  ["bancarios", "banco", "Banco", "banco"],
  ["bancarios", "tipoConta", "Tipo de conta", "banco"],
  ["bancarios", "agencia", "Agência", "banco"],
  ["bancarios", "conta", "Conta", "banco"],
  ["bancarios", "pix", "Chave PIX", "banco"],

  ["_calc", "docsQtd", "Documentos entregues (qtd.)"],
  ["documentos", "entregues", "Documentos entregues"],

  ["_calc", "criadoEm", "Inscrição feita em"],
  ["raiz", "criadoPor", "Inscrição feita por"],
  ["_calc", "atualizadoEm", "Última atualização"],
  ["raiz", "atualizadoPor", "Atualizado por"]
];

// campos de múltipla escolha com opção "Outro": o texto digitado vai junto
const SECOES_CONHECIDAS = ["identificacao", "inscricao", "pessoais", "domicilio", "programa", "bancarios", "documentos"];
const IGNORAR = new Set(["inscricao.curso", "raiz.criadoEm", "raiz.atualizadoEm"]); // já aparecem de outra forma

const texto = (v) => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.filter((x) => x !== "" && x != null).join("; ");
  if (typeof v === "object") return Object.entries(v).map(([k, x]) => k + ": " + texto(x)).join("; ");
  return String(v).trim();
};

function dataBR(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto(iso);
}
function idade(iso, hoje = new Date()) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  let a = hoje.getFullYear() - +m[1];
  if (hoje.getMonth() + 1 < +m[2] || (hoje.getMonth() + 1 === +m[2] && hoje.getDate() < +m[3])) a--;
  return a >= 0 && a < 130 ? a : "";
}
function dataHora(v) {
  const n = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(n) && n > 0 ? new Date(n).toLocaleString("pt-BR") : texto(v);
}

// valor de uma resposta, juntando o texto do "Outro" quando houver
function resposta(sec, campo) {
  const base = texto(sec[campo]);
  const outro = texto(sec[campo + "Outro"]);
  if (!outro) return base;
  return base ? `${base} (Outro: ${outro})` : `Outro: ${outro}`;
}

/** Monta cabeçalho e linhas (função pura, sem SheetJS). */
export function montarTabela(registros, { comBanco = true } = {}) {
  const cols = COLUNAS.filter((c) => comBanco || c[3] !== "banco");

  // procura campos que existem no banco e não estão em COLUNAS (para nada ficar de fora)
  const conhecidos = new Set(COLUNAS.map(([s, c]) => s + "." + c));
  COLUNAS.forEach(([s, c]) => conhecidos.add(s + "." + c + "Outro"));
  const extras = [];
  const vistos = new Set();
  registros.forEach(({ dados }) => {
    Object.entries(dados || {}).forEach(([sec, val]) => {
      const ehSecao = SECOES_CONHECIDAS.includes(sec) || (val && typeof val === "object" && !Array.isArray(val));
      if (ehSecao) {
        if (!comBanco && sec === "bancarios") return;
        Object.keys(val || {}).forEach((campo) => {
          const chave = sec + "." + campo;
          if (!conhecidos.has(chave) && !IGNORAR.has(chave) && !vistos.has(chave)) { vistos.add(chave); extras.push([sec, campo, `${sec} • ${campo}`]); }
        });
      } else {
        const chave = "raiz." + sec;
        if (!conhecidos.has(chave) && !IGNORAR.has(chave) && !vistos.has(chave)) { vistos.add(chave); extras.push(["raiz", sec, sec]); }
      }
    });
  });

  const todas = cols.concat(extras);
  const cabecalho = ["Nº", ...todas.map((c) => c[2])];

  const linhas = registros.map(({ id, dados }, n) => {
    const d = dados || {};
    const ident = d.identificacao || {};
    const entregues = (d.documentos && d.documentos.entregues) || [];
    return [n + 1, ...todas.map(([sec, campo]) => {
      if (sec === "_calc") {
        if (campo === "idade") return idade(ident.nascimento);
        if (campo === "docsQtd") return (Array.isArray(entregues) ? entregues.length : 0) + " de 6";
        if (campo === "criadoEm") return dataHora(d.criadoEm);
        if (campo === "atualizadoEm") return dataHora(d.atualizadoEm);
        return "";
      }
      if (sec === "raiz") return texto(d[campo]);
      if (sec === "identificacao" && campo === "nascimento") return dataBR(ident.nascimento);
      if (sec === "identificacao" && campo === "cpf") return texto(ident.cpf || id);
      if (sec === "inscricao" && campo === "cursoNome") return texto((d.inscricao || {}).cursoNome || (d.inscricao || {}).curso);
      return resposta(d[sec] || {}, campo);
    })];
  });

  return { cabecalho, linhas };
}

// nome de aba válido no Excel (máx. 31 caracteres, sem : \ / ? * [ ]) e sem repetir
function nomeAba(nome, usados) {
  let base = String(nome || "Curso").replace(/[:\\/?*\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Curso";
  let n = base, i = 2;
  while (usados.has(n.toLowerCase())) { const suf = " (" + i++ + ")"; n = base.slice(0, 31 - suf.length) + suf; }
  usados.add(n.toLowerCase());
  return n;
}

function criarAba(XLSX, cabecalho, linhas) {
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
  // largura das colunas pelo maior conteúdo (com limites)
  ws["!cols"] = cabecalho.map((h, c) => {
    const maior = Math.max(String(h).length, ...linhas.map((l) => String(l[c] ?? "").length));
    return { wch: Math.min(Math.max(maior + 2, 6), 60) };
  });
  if (linhas.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cabecalho.length - 1 } }) };
  return ws;
}

/**
 * Gera e baixa o .xlsx.
 * grupos: [{ nome, registros: [{ id, dados }] }] — cursos e inscrições (já em ordem)
 */
export function baixarPlanilha(grupos, { comBanco = true, arquivo = "inscricoes.xlsx" } = {}) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error("O gerador de planilhas não carregou. Recarregue a página e tente de novo.");

  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const total = grupos.reduce((s, g) => s + g.registros.length, 0);

  // Resumo
  const resumo = [
    ["Inscrições — IF Sudeste MG, Campus São João Nepomuceno"],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    ["Dados bancários", comBanco ? "incluídos" : "não incluídos"],
    [],
    ["Curso", "Inscritas"],
    ...grupos.map((g) => [g.nome, g.registros.length]),
    ["Total", total]
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: Math.max(30, ...grupos.map((g) => String(g.nome).length + 2)) }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, nomeAba("Resumo", usados));

  // Todas as inscrições (uma linha por aluna)
  const todos = grupos.flatMap((g) => g.registros);
  const geral = montarTabela(todos, { comBanco });
  XLSX.utils.book_append_sheet(wb, criarAba(XLSX, geral.cabecalho, geral.linhas), nomeAba("Todas as inscrições", usados));

  // Uma aba por curso (só faz sentido com mais de um curso)
  if (grupos.length > 1) {
    grupos.forEach((g) => {
      const t = montarTabela(g.registros, { comBanco });
      XLSX.utils.book_append_sheet(wb, criarAba(XLSX, t.cabecalho, t.linhas), nomeAba(g.nome, usados));
    });
  }

  XLSX.writeFile(wb, arquivo, { compression: true });
}
