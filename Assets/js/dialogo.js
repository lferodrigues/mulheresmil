/* =========================================================
   Pop-up personalizado — Painel Mulheres Mil
   Substitui os confirm() e alert() do navegador por um pop-up
   no estilo do painel (verde, com ícone e detalhes).

   Uso (dentro de um <script type="module">):
     import { confirmar, avisar } from "./Assets/js/dialogo.js";

     if (!(await confirmar({
       titulo: "Salvar chamada",
       texto: "Isso substitui o que já estava salvo para este curso.",
       detalhes: [["Curso", "Educação Inclusiva"], ["Listas", "1"]],
       botaoOk: "Sim, salvar",
       tipo: "sucesso"            // "sucesso" | "perigo" | "info" | "alerta"
     }))) return;

     await avisar({ titulo: "Atenção", texto: "As alunas ainda não foram carregadas.", tipo: "alerta" });

   Teclado: Enter confirma, Esc cancela, Tab fica dentro do pop-up.
   O pop-up cria o próprio HTML e CSS: funciona em qualquer página.
   ========================================================= */

const ICONES = {
  sucesso: '<path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  perigo:  '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1.5 1.5 0 001.5 1.4h6a1.5 1.5 0 001.5-1.4l1-12.5M9 7V4.5h6V7"/>',
  info:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  alerta:  '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.1"/>',
  nuvem:   '<path d="M7 18.5a4.5 4.5 0 01-.6-9 6 6 0 0111.5 1.6A3.8 3.8 0 0117.5 18.5z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>'
};

const CSS = `
.dlg-fundo{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:20px;
  background:rgba(20,30,22,.5);opacity:0;transition:opacity .16s ease}
.dlg-fundo.aberto{opacity:1}
.dlg-caixa{width:min(440px,100%);max-height:calc(100vh - 40px);overflow-y:auto;background:#fff;border-radius:6px;
  box-shadow:0 18px 50px rgba(0,0,0,.25);border-top:4px solid var(--dlg-cor);
  font-family:"Open Sans",Arial,Helvetica,sans-serif;color:var(--text,#24160d);
  transform:translateY(8px) scale(.98);transition:transform .16s ease}
.dlg-fundo.aberto .dlg-caixa{transform:none}
.dlg-topo{display:flex;gap:14px;align-items:flex-start;padding:20px 22px 4px}
.dlg-icone{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;
  background:var(--dlg-fundo);color:var(--dlg-cor)}
.dlg-icone svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.dlg-titulo{margin:0;font-size:16.5px;font-weight:600;color:var(--dlg-titulo);line-height:1.35}
.dlg-texto{margin:5px 0 0;font-size:13.5px;line-height:1.5;color:var(--text-2,#5f5650);white-space:pre-line}
.dlg-detalhes{display:grid;gap:6px;margin:12px 22px 0;padding:10px 12px;background:#f6f8f6;
  border:1px solid var(--border,#e4e7e5);border-radius:4px}
.dlg-detalhes div{display:flex;justify-content:space-between;gap:14px;font-size:13px}
.dlg-detalhes span{color:#8a8079}
.dlg-detalhes strong{font-weight:600;text-align:right;overflow-wrap:anywhere}
.dlg-acoes{display:flex;justify-content:flex-end;gap:8px;padding:18px 22px 18px}
.dlg-btn{display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:38px;padding:0 16px;
  border-radius:4px;border:1px solid transparent;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.dlg-btn:focus-visible{outline:2px solid var(--dlg-cor);outline-offset:2px}
.dlg-cancelar{background:#fff;color:var(--text-2,#5f5650);border-color:#cfd6d1}
.dlg-cancelar:hover{background:#f3f5f4}
.dlg-ok{background:var(--dlg-cor);color:#fff}
.dlg-ok:hover{filter:brightness(.92)}
.dlg-sucesso{--dlg-cor:var(--verde,#048a28);--dlg-fundo:#eef7f0;--dlg-titulo:var(--verde-escuro,#05601f)}
.dlg-info{--dlg-cor:var(--verde,#048a28);--dlg-fundo:#eef7f0;--dlg-titulo:var(--verde-escuro,#05601f)}
.dlg-perigo{--dlg-cor:var(--vermelho,#dd0c11);--dlg-fundo:#fdeeee;--dlg-titulo:var(--vermelho-escuro,#b80a0e)}
.dlg-alerta{--dlg-cor:#b7791f;--dlg-fundo:#fff8e6;--dlg-titulo:#7a5a00}
@media (max-width:480px){
  .dlg-topo{padding:18px 16px 4px}.dlg-detalhes{margin:12px 16px 0}
  .dlg-acoes{padding:16px}.dlg-btn{flex:1}
}
@media (prefers-reduced-motion:reduce){.dlg-fundo,.dlg-caixa{transition:none}}
`;

let cssPronto = false;
function prepararCss() {
  if (cssPronto) return;
  const s = document.createElement("style");
  s.id = "dialogo-css";
  s.textContent = CSS;
  document.head.appendChild(s);
  cssPronto = true;
}

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

let fila = Promise.resolve(); // um pop-up por vez

function abrir({ titulo = "Confirmar", texto = "", detalhes = [], tipo = "info", icone,
                 botaoOk = "OK", botaoCancelar = "Cancelar", soOk = false }) {
  prepararCss();
  return new Promise((resolver) => {
    const anterior = document.activeElement;
    const fundo = document.createElement("div");
    fundo.className = "dlg-fundo dlg-" + (ICONES[tipo] ? tipo : "info");
    const idT = "dlg-t-" + Date.now();
    fundo.innerHTML = `
      <div class="dlg-caixa" role="${soOk ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="${idT}">
        <div class="dlg-topo">
          <div class="dlg-icone" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONES[icone] || ICONES[tipo] || ICONES.info}</svg></div>
          <div>
            <h2 class="dlg-titulo" id="${idT}">${esc(titulo)}</h2>
            ${texto ? `<p class="dlg-texto">${esc(texto)}</p>` : ""}
          </div>
        </div>
        ${detalhes.length ? `<div class="dlg-detalhes">${detalhes.map(([k, v]) =>
          `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>` : ""}
        <div class="dlg-acoes">
          ${soOk ? "" : `<button type="button" class="dlg-btn dlg-cancelar">${esc(botaoCancelar)}</button>`}
          <button type="button" class="dlg-btn dlg-ok">${esc(botaoOk)}</button>
        </div>
      </div>`;
    document.body.appendChild(fundo);
    requestAnimationFrame(() => fundo.classList.add("aberto"));

    const ok = fundo.querySelector(".dlg-ok");
    const cancelar = fundo.querySelector(".dlg-cancelar");
    const botoes = [cancelar, ok].filter(Boolean);
    // no pop-up de exclusão, o foco começa no "Cancelar" (evita apagar sem querer com Enter)
    (tipo === "perigo" && cancelar ? cancelar : ok).focus();

    function fechar(resposta) {
      document.removeEventListener("keydown", teclas, true);
      fundo.classList.remove("aberto");
      setTimeout(() => fundo.remove(), 160);
      if (anterior && anterior.focus) anterior.focus();
      resolver(resposta);
    }
    function teclas(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(soOk); }
      else if (e.key === "Tab") {           // mantém o foco dentro do pop-up
        const i = botoes.indexOf(document.activeElement);
        e.preventDefault();
        botoes[(i + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length].focus();
      }
    }
    document.addEventListener("keydown", teclas, true);
    ok.onclick = () => fechar(true);
    if (cancelar) cancelar.onclick = () => fechar(false);
    fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(soOk); });
  });
}

function enfileirar(opcoes) {
  const p = fila.then(() => abrir(opcoes));
  fila = p.catch(() => {});
  return p;
}

/** Pergunta com "Cancelar" e "OK". Resolve true (confirmou) ou false (cancelou). */
export function confirmar(opcoes) {
  return enfileirar({ botaoOk: "Confirmar", ...opcoes, soOk: false });
}

/** Aviso com um único botão "Entendi". Resolve quando for fechado. */
export function avisar(opcoes) {
  return enfileirar({ tipo: "alerta", botaoOk: "Entendi", ...opcoes, soOk: true }).then(() => undefined);
}
