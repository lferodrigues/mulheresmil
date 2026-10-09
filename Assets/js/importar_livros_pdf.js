/* =========================================================
   Importar catálogo de livros em PDF — Biblioteca Itinerante
   ---------------------------------------------------------
   Lê um PDF com uma tabela de 4 colunas:
     Nº | Título | Autor / responsável | Gênero / assunto
   (o cabeçalho pode se repetir em cada página).

   - As colunas são localizadas pela posição (x) do cabeçalho.
   - Linhas que começam com número viram um livro novo.
   - Linhas sem número logo abaixo de um livro (texto que quebrou
     de linha, ex.: autor muito longo) são juntadas ao livro anterior.
   - Precisa da biblioteca pdf.js (carregada no cadastro_livros.html).
     PDFs digitalizados (imagem, sem texto) não funcionam.
   ========================================================= */

const WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/* ---------- utilidades ---------- */

const limpa = s => String(s ?? "").replace(/\s+/g, " ").trim();

// texto sem acento e minúsculo, para comparar
export const normaliza = s => limpa(s)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase();

// junta pedaços de texto (trata palavra quebrada com hífen no fim da linha)
function junta(a, b) {
  a = limpa(a); b = limpa(b);
  if (!a) return b;
  if (!b) return a;
  return /-$/.test(a) ? a + b : a + " " + b;
}

/* ---------- cabeçalho ---------- */

const TESTES = {
  numero: t => /^n\s*[º°o.]?\s*$/i.test(t) || /^n[º°o]\b/i.test(t) || /^(numero|codigo|cod\.?)$/i.test(normaliza(t)),
  titulo: t => /^titulo/.test(normaliza(t)),
  autor:  t => /^autor/.test(normaliza(t)),
  genero: t => /^(genero|categoria|assunto)/.test(normaliza(t))
};

// Se a linha for o cabeçalho da tabela, devolve o x inicial de cada coluna.
function lerCabecalho(linha) {
  const col = {};
  for (const it of linha) {
    for (const [nome, teste] of Object.entries(TESTES)) {
      if (col[nome] === undefined && teste(it.str)) col[nome] = it.x;
    }
  }
  if (col.titulo === undefined || col.autor === undefined) return null;
  if (col.numero === undefined) col.numero = Math.min(...linha.map(i => i.x));
  if (col.genero === undefined) col.genero = Infinity;
  return col;
}

// Em qual coluna cai um texto que começa na posição x
function colunaDe(x, col) {
  const folga = 4;
  const ordem = ["numero", "titulo", "autor", "genero"]
    .filter(c => Number.isFinite(col[c]))
    .sort((a, b) => col[a] - col[b]);
  let achou = ordem[0];
  for (const c of ordem) if (x + folga >= col[c]) achou = c;
  return achou;
}

/* ---------- linhas do PDF ---------- */

// Agrupa os textos de uma página em linhas (mesma altura), da esquerda para a direita
function agruparLinhas(itens) {
  const ord = itens
    .filter(i => limpa(i.str))
    .sort((a, b) => a.top - b.top || a.x - b.x);
  const linhas = [];
  for (const it of ord) {
    const ult = linhas[linhas.length - 1];
    const tol = Math.max(2, (it.h || 8) * 0.45);
    if (ult && Math.abs(ult.top - it.top) <= tol) ult.itens.push(it);
    else linhas.push({ top: it.top, h: it.h || 8, itens: [it] });
  }
  linhas.forEach(l => l.itens.sort((a, b) => a.x - b.x));
  return linhas;
}

/* ---------- extração (pura, sem pdf.js) ---------- */

// paginas: [[{ str, x, top, h }]]  →  { livros: [{ numero, titulo, autor, genero }], erro }
export function extrairLivros(paginas) {
  const livros = [];
  let col = null;       // posições das colunas (do último cabeçalho visto)
  let atual = null;     // livro em montagem
  let ultimoTop = 0;    // altura da última linha usada pelo livro atual

  for (const itens of paginas) {
    atual = null; // um livro não continua de uma página para outra

    for (const linha of agruparLinhas(itens)) {
      const cab = lerCabecalho(linha.itens);
      if (cab) { col = cab; atual = null; continue; }
      if (!col) continue; // texto antes da tabela (título, observações...)

      // distribui os textos da linha pelas colunas
      const cel = { numero: "", titulo: "", autor: "", genero: "" };
      for (const it of linha.itens) {
        let c = colunaDe(it.x, col);
        let txt = it.str;
        // se o nº veio grudado no título ("12 Título..."), separa
        if (c === "numero") {
          const m = limpa(txt).match(/^(\d{1,6})\s+(.+)$/);
          if (m) { cel.numero = junta(cel.numero, m[1]); cel.titulo = junta(cel.titulo, m[2]); continue; }
        }
        cel[c] = junta(cel[c], txt);
      }

      if (/^\d{1,6}$/.test(cel.numero)) {
        atual = {
          numero: cel.numero,
          titulo: cel.titulo,
          autor: cel.autor,
          genero: cel.genero
        };
        livros.push(atual);
        ultimoTop = linha.top;
      } else if (atual && !cel.numero && linha.top - ultimoTop <= linha.h * 2) {
        // continuação do livro anterior (texto que quebrou de linha)
        atual.titulo = junta(atual.titulo, cel.titulo);
        atual.autor  = junta(atual.autor, cel.autor);
        atual.genero = junta(atual.genero, cel.genero);
        ultimoTop = linha.top;
      } else {
        atual = null; // texto solto fora da tabela
      }
    }
  }

  if (!col) {
    return { livros: [], erro: "Não encontrei o cabeçalho da tabela (Nº, Título, Autor, Gênero) neste PDF." };
  }
  const validos = livros.filter(l => l.titulo);
  return {
    livros: validos,
    erro: validos.length ? "" : "Encontrei a tabela, mas nenhum livro com número e título."
  };
}

/* ---------- leitura do arquivo (pdf.js) ---------- */

export async function lerCatalogoPdf(buffer) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    return { livros: [], erro: "O leitor de PDF não carregou. Recarregue a página e tente de novo." };
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (e) {
    console.error(e);
    return { livros: [], erro: "Não foi possível abrir este arquivo. Confira se é um PDF válido (e sem senha)." };
  }

  const paginas = [];
  let temTexto = false;
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const altura = pagina.getViewport({ scale: 1 }).height;
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({
        str: i.str,
        x: i.transform[4],
        top: altura - i.transform[5],
        h: Math.abs(i.transform[3]) || i.height || 8
      }));
    if (itens.length) temTexto = true;
    paginas.push(itens);
  }

  if (!temTexto) {
    return { livros: [], erro: "Este PDF não tem texto (parece digitalizado). Use um PDF gerado no computador." };
  }
  return extrairLivros(paginas);
}
