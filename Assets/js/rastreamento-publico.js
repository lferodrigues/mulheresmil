/* Rastreamento de visitantes — página pública (index.html)
   Registra, sem exigir login, cada visita: IP, ID do aparelho, dispositivo, cliques e tempo em tela.
   Grava em visitasSite/{id} (Realtime Database) pela API REST, um evento por vez:
     tipo "visita"  -> ip, dispositivo, sistema, navegador, tela, idioma, fuso, origem
     tipo "clique"  -> acao (o que foi clicado) e t (segundos desde que a página abriu)
     tipo "saida"   -> tempo (segundos em que a página ficou visível na tela)
   Todos os eventos de uma abertura de página compartilham o mesmo "vid".
   O campo "did" é um ID persistente do aparelho/navegador (o endereço MAC não é acessível por páginas web).
   Privacidade: nunca lê nem grava texto digitado em campos.
   Nunca interrompe a página: se algo falhar, só avisa no console. */
(function () {
  "use strict";
  if (window.__mmVisitas) return;
  window.__mmVisitas = true;

  var URL_BANCO = "https://biblioteca-virtual-8db41-default-rtdb.firebaseio.com/visitasSite.json";
  var MAX_CLIQUES = 60;   // limite por abertura de página (evita lixo/spam)

  /* ---------- identificação da visita ---------- */
  function aleatorio() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  var vid = aleatorio();
  var sessao = "";
  try { sessao = sessionStorage.getItem("mm_sessao_publica") || ""; } catch (e) {}
  if (!sessao) {
    sessao = aleatorio();
    try { sessionStorage.setItem("mm_sessao_publica", sessao); } catch (e) {}
  }

  /* ---------- ID persistente do aparelho (substitui o MAC, que o navegador não fornece) ---------- */
  var did = "";
  try { did = localStorage.getItem("mm_device_id") || ""; } catch (e) {}
  if (!did) {
    did = "D-" + aleatorio().toUpperCase();
    try { localStorage.setItem("mm_device_id", did); } catch (e) {}
  }

  var pagina = (location.pathname.split("/").pop() || "index.html").slice(0, 60);

  function limpar(t, n) { return String(t || "").replace(/\s+/g, " ").trim().slice(0, n); }

  /* ---------- dispositivo ---------- */
  function detectar() {
    var ua = navigator.userAgent || "";
    var toque = (navigator.maxTouchPoints || 0) > 1;
    var ipadOS = /Macintosh/.test(ua) && toque;

    var tipo = "Computador";
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || ipadOS || (/Android/i.test(ua) && !/Mobile/i.test(ua))) tipo = "Tablet";
    else if (/Mobi|iPhone|iPod|Android/i.test(ua)) tipo = "Celular";

    var sistema = "";
    if (/Windows/.test(ua)) sistema = "Windows";
    else if (/Android/.test(ua)) sistema = "Android";
    else if (/iPhone|iPad|iPod/.test(ua) || ipadOS) sistema = "iOS";
    else if (/Mac OS/.test(ua)) sistema = "macOS";
    else if (/CrOS/.test(ua)) sistema = "ChromeOS";
    else if (/Linux/.test(ua)) sistema = "Linux";

    var navegador = "Outro";
    if (/Edg\//.test(ua)) navegador = "Edge";
    else if (/OPR\//.test(ua)) navegador = "Opera";
    else if (/SamsungBrowser/.test(ua)) navegador = "Samsung Internet";
    else if (/Firefox\/|FxiOS/.test(ua)) navegador = "Firefox";
    else if (/Chrome\/|CriOS/.test(ua)) navegador = "Chrome";
    else if (/Safari\//.test(ua)) navegador = "Safari";

    return { tipo: tipo, sistema: sistema, navegador: navegador };
  }

  /* ---------- IP público (ipify; guardado na sessão) ---------- */
  function obterIp(cb) {
    try { var c = sessionStorage.getItem("mm_ip"); if (c) return cb(c); } catch (e) {}
    var feito = false;
    function fim(ip) { if (feito) return; feito = true; cb(ip || ""); }
    var t = setTimeout(function () { fim(""); }, 3000);
    try {
      fetch("https://api.ipify.org?format=json", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var ip = String((j && j.ip) || "");
          if (ip) { try { sessionStorage.setItem("mm_ip", ip); } catch (e) {} }
          clearTimeout(t); fim(ip);
        })
        .catch(function () { clearTimeout(t); fim(""); });
    } catch (e) { clearTimeout(t); fim(""); }
  }

  /* ---------- envio ---------- */
  // "saindo" = a página está fechando/navegando: usa sendBeacon, que sobrevive à troca de página.
  function enviar(obj, saindo) {
    obj.vid = vid;
    obj.sessao = sessao;
    obj.did = did;
    obj.pagina = pagina;
    obj.quando = Date.now();
    obj.data = { ".sv": "timestamp" };
    var corpo = JSON.stringify(obj);
    try {
      if (saindo && navigator.sendBeacon &&
          navigator.sendBeacon(URL_BANCO, new Blob([corpo], { type: "text/plain;charset=UTF-8" }))) return;
    } catch (e) {}
    try {
      fetch(URL_BANCO, {
        method: "POST", body: corpo, keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
      }).then(function (r) {
        if (!r.ok) console.warn("[visitas] gravação recusada (" + r.status + "). Confira as regras de 'visitasSite'.");
      }).catch(function (e) { console.warn("[visitas] erro ao gravar:", e); });
    } catch (e) {}
  }

  /* ---------- visita ---------- */
  var ipAtual = "", visitaEnviada = false;
  function enviarVisita(saindo) {
    if (visitaEnviada) return;
    visitaEnviada = true;
    var d = detectar();
    var origem = "";
    try { origem = document.referrer ? new URL(document.referrer).host : ""; } catch (e) {}
    enviar({
      tipo: "visita",
      ip: limpar(ipAtual, 64),
      dispositivo: d.tipo,
      sistema: d.sistema,
      navegador: d.navegador,
      tela: (screen.width || 0) + "x" + (screen.height || 0),
      idioma: limpar(navigator.language, 20),
      fuso: limpar((Intl.DateTimeFormat().resolvedOptions().timeZone) || "", 60),
      origem: limpar(origem, 120)
    }, !!saindo);
  }
  obterIp(function (ip) { ipAtual = ip; enviarVisita(false); });

  /* ---------- tempo em tela (só conta enquanto a aba está visível) ---------- */
  var acumulado = 0;
  var desde = document.visibilityState === "hidden" ? null : performance.now();
  var ultimoEnviado = -1;

  function tempoAtual() {
    var extra = desde === null ? 0 : performance.now() - desde;
    return Math.round((acumulado + extra) / 1000);
  }
  function pausar() {
    if (desde !== null) { acumulado += performance.now() - desde; desde = null; }
  }
  function enviarSaida() {
    var t = tempoAtual();
    if (t === ultimoEnviado) return;
    ultimoEnviado = t;
    enviar({ tipo: "saida", tempo: Math.min(t, 86400) }, true);
  }
  function aoSair() { pausar(); enviarVisita(true); enviarSaida(); }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") aoSair();
    else if (desde === null) desde = performance.now();
  });
  window.addEventListener("pagehide", aoSair);

  /* ---------- cliques ---------- */
  var nCliques = 0;
  document.addEventListener("click", function (e) {
    if (nCliques >= MAX_CLIQUES) return;
    nCliques++;

    var alvo = e.target && e.target.closest
      ? e.target.closest("a, button, [role=button], input[type=button], input[type=submit], summary, label")
      : null;
    var acao;
    if (alvo) {
      var forte = alvo.querySelector ? alvo.querySelector("strong") : null;
      var rotulo = limpar((forte && forte.innerText) || alvo.innerText || alvo.getAttribute("aria-label") || alvo.title || alvo.value || alvo.id, 70);
      var ehLink = alvo.tagName === "A";
      acao = (ehLink ? "Link: " : "Botão: ") + (rotulo || "(sem texto)");
      if (ehLink) acao += " → " + limpar((alvo.getAttribute("href") || "").split("/").pop(), 50);
    } else {
      var w = Math.max(document.documentElement.scrollWidth, 1);
      var h = Math.max(document.documentElement.scrollHeight, 1);
      acao = "Clique na página (" + Math.round((e.pageX / w) * 100) + "% / " + Math.round((e.pageY / h) * 100) + "%)";
    }
    enviar({ tipo: "clique", acao: acao.slice(0, 180), t: Math.min(tempoAtual(), 86400) }, true);
  }, true);
})();
