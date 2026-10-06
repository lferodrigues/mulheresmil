/* Rastreamento de ações — registra páginas abertas, cliques e seleções de quem está logado.
   Importado pelo auth-guard.js; nas páginas sem auth-guard, use:
   <script type="module" src="./Assets/js/rastreamento.js"></script>
   Privacidade: nunca grava valores de campos digitados; ignora contexto que contenha campo de senha. */
import { auth } from "./firebase-config.js";
import { registrarEvento, descarregarFila } from "./logs-acesso.js";

if (!window.__mmRastreamento) {
  window.__mmRastreamento = true;

  const SEL = "button, a[href], [role=button], input[type=button], input[type=submit], summary, label.drop";
  const limpar = (t, n) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);

  (async () => {
    try { await auth.authStateReady(); } catch (_) {}
    if (!auth.currentUser) return;

    registrarEvento("pagina", { acao: "Abriu a página", detalhe: limpar(document.title, 120) });

    // Cliques (captura: roda ANTES do clique fechar/limpar pop-ups, então o contexto ainda existe)
    document.addEventListener("click", (e) => {
      const el = e.target.closest && e.target.closest(SEL);
      if (!el || el.matches(".btn-olho, .olho")) return;

      const rotulo = limpar(el.innerText || el.getAttribute("aria-label") || el.title || el.value || el.id, 80);
      const ehLink = el.tagName === "A";
      let acao = (ehLink ? "Link: " : "Botão: ") + (rotulo || "(sem texto)");
      if (ehLink) acao += " → " + limpar((el.getAttribute("href") || "").split("/").pop(), 60);

      // contexto: dados do pop-up de confirmação, do livro/aluna da linha, etc.
      const ctx = el.closest(".modal-box, .livro-item, .sino-item, #lista > div, tr");
      const detalhe = ctx && !ctx.querySelector("input[type=password]") ? limpar(ctx.textContent, 300) : "";

      registrarEvento("clique", { acao, detalhe });
    }, true);

    // Seleções (select, caixa de marcar, arquivo escolhido) — só o rótulo/nome, nunca texto digitado
    document.addEventListener("change", (e) => {
      const el = e.target;
      if (!el || !el.matches) return;
      if (el.matches("select")) {
        registrarEvento("selecao", { acao: "Selecionou: " + limpar(el.options[el.selectedIndex]?.text, 80), detalhe: el.id || el.name || "" });
      } else if (el.matches("input[type=checkbox]")) {
        registrarEvento("selecao", { acao: (el.checked ? "Marcou: " : "Desmarcou: ") + limpar(el.closest("label")?.innerText || el.id, 80) });
      } else if (el.matches("input[type=file]")) {
        registrarEvento("selecao", { acao: "Escolheu arquivo(s)", detalhe: limpar([...el.files].map((f) => f.name).join(", "), 200) });
      }
    }, true);

    // Ao sair/ocultar a aba, tenta enviar o que ainda está na fila
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") descarregarFila(); });
    window.addEventListener("pagehide", descarregarFila);
  })();
}
