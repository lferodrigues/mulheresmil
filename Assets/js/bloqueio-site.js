/* Bloqueio temporário de visitantes — páginas públicas (versão em TEMPO REAL)
   O administrador bloqueia um visitante pela aba "Visitas ao site" (logs_acesso.html).
   O bloqueio é gravado em bloqueios/{chave} = { ate, ip, did, por, criadoEm } no Realtime Database:
     chave "d_<ID do aparelho>"  -> bloqueia o aparelho/navegador
     chave "i_<IP>"              -> bloqueia o IP (todos os aparelhos daquela rede)
   Esta página "escuta" essas chaves por streaming (EventSource, API REST do Firebase, sem login):
   assim que o administrador bloqueia ou desbloqueia, a tela do visitante muda NA HORA,
   sem recarregar. Há também uma consulta de segurança a cada 30 s (caso o streaming caia).
   Observação: é um bloqueio feito no navegador (a hospedagem é estática); ele impede o uso
   normal do site, mas não substitui um bloqueio no servidor.
   Nunca interrompe a página: se algo falhar, o visitante não é bloqueado. */
(function () {
  "use strict";
  if (window.__mmBloqueio) return;
  window.__mmBloqueio = true;

  var BASE = "https://biblioteca-virtual-8db41-default-rtdb.firebaseio.com/bloqueios/";
  var RECHECAR_MS = 30000;   // consulta de segurança (o streaming é quem dá o efeito instantâneo)

  var ate = { d: 0, i: 0 };  // fim do bloqueio por aparelho (d) e por IP (i)
  var caixa = null, iv = null;

  function chave(prefixo, valor) {
    return prefixo + String(valor).replace(/[.#$\[\]\/\s]/g, "_");
  }
  function dois(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- aviso na tela ---------- */
  function montarCaixa() {
    caixa = document.createElement("div");
    caixa.setAttribute("role", "alertdialog");
    caixa.setAttribute("aria-live", "polite");
    caixa.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "padding:24px;background:rgba(47,16,39,.94);font-family:'Segoe UI',Arial,sans-serif;text-align:center;color:#fff";
    caixa.innerHTML =
      '<div style="max-width:420px;background:#fff;color:#3b2931;border-radius:22px;padding:32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
        '<img src="/if-sjn.png" alt="Mulheres Mil - IF Sudeste MG" style="display:block;max-width:100%;width:260px;max-height:90px;object-fit:contain;margin:0 auto 18px">' +
        '<div style="font-size:48px;line-height:1">🚫</div>' +
        '<h1 style="margin:12px 0 8px;font-size:22px;color:#5a1738">Acesso temporariamente bloqueado</h1>' +
        '<p style="margin:0 0 14px;color:#76656c;font-size:15px;line-height:1.5">Seu acesso a este site foi suspenso por alguns minutos.</p>' +
        '<div style="font-size:34px;font-weight:800;color:#c62828" id="mmBloqTempo">--:--</div>' +
        '<p style="margin:10px 0 0;color:#8a777f;font-size:13px">O site será liberado automaticamente.</p>' +
      '</div>';
    function anexar() {
      if (!caixa) return;
      document.body.appendChild(caixa);
      document.documentElement.style.overflow = "hidden";
    }
    if (document.body) anexar(); else document.addEventListener("DOMContentLoaded", anexar);
  }

  function esconderCaixa() {
    if (iv) { clearInterval(iv); iv = null; }
    if (caixa) {
      if (caixa.parentNode) caixa.parentNode.removeChild(caixa);
      caixa = null;
      document.documentElement.style.overflow = "";
    }
  }

  function fim() { return Math.max(ate.d, ate.i); }

  function tick() {
    var resta = Math.max(0, Math.ceil((fim() - Date.now()) / 1000));
    if (resta <= 0) { esconderCaixa(); return; }
    var el = caixa && caixa.querySelector("#mmBloqTempo");
    if (el) el.textContent = dois(Math.floor(resta / 60)) + ":" + dois(resta % 60);
  }

  // Chamada sempre que o valor de um bloqueio muda: mostra ou tira o aviso imediatamente
  function atualizar() {
    if (fim() > Date.now()) {
      if (!caixa) montarCaixa();
      if (!iv) iv = setInterval(tick, 1000);
      tick();
    } else {
      esconderCaixa();
    }
  }

  /* ---------- leitura única (consulta de segurança) ---------- */
  function consultar(k) {
    return fetch(BASE + encodeURIComponent(k) + ".json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && Number(j.ate)) || 0; })
      .catch(function () { return 0; });
  }

  /* ---------- streaming em tempo real ---------- */
  // Escuta bloqueios/{k}; cada mudança chama onAte(novoFim)
  function escutar(k, onAte) {
    if (!window.EventSource) return null;
    var estado = null;
    function aplicar() { onAte((estado && Number(estado.ate)) || 0); }
    try {
      var es = new EventSource(BASE + encodeURIComponent(k) + ".json");
      es.addEventListener("put", function (ev) {
        try {
          var m = JSON.parse(ev.data), p = m.path || "/";
          if (p === "/") estado = m.data;
          else {
            if (!estado || typeof estado !== "object") estado = {};
            estado[p.replace(/^\//, "").split("/")[0]] = m.data;
          }
          aplicar();
        } catch (e) {}
      });
      es.addEventListener("patch", function (ev) {
        try {
          var m = JSON.parse(ev.data);
          if (!estado || typeof estado !== "object") estado = {};
          var d = m.data || {};
          for (var c in d) if (Object.prototype.hasOwnProperty.call(d, c)) estado[c] = d[c];
          aplicar();
        } catch (e) {}
      });
      // erros (queda de rede, permissão): o EventSource tenta reconectar sozinho
      es.onerror = function () {};
      return es;
    } catch (e) { return null; }
  }

  function obterIp() {
    try { var c = sessionStorage.getItem("mm_ip"); if (c) return Promise.resolve(c); } catch (e) {}
    return new Promise(function (resolve) {
      var feito = false;
      function fimIp(ip) { if (feito) return; feito = true; resolve(ip || ""); }
      var t = setTimeout(function () { fimIp(""); }, 3000);
      try {
        fetch("https://api.ipify.org?format=json", { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var ip = String((j && j.ip) || "");
            if (ip) { try { sessionStorage.setItem("mm_ip", ip); } catch (e) {} }
            clearTimeout(t); fimIp(ip);
          })
          .catch(function () { clearTimeout(t); fimIp(""); });
      } catch (e) { clearTimeout(t); fimIp(""); }
    });
  }

  function iniciar() {
    var did = "";
    try { did = localStorage.getItem("mm_device_id") || ""; } catch (e) {}

    var kd = did ? chave("d_", did) : "";
    var ki = "";

    // 1) tempo real
    if (kd) escutar(kd, function (v) { ate.d = v; atualizar(); });
    obterIp().then(function (ip) {
      if (!ip) return;
      ki = chave("i_", ip);
      escutar(ki, function (v) { ate.i = v; atualizar(); });
    }).catch(function () {});

    // 2) consulta de segurança, caso o streaming esteja indisponível
    function checar() {
      Promise.all([
        kd ? consultar(kd) : Promise.resolve(0),
        ki ? consultar(ki) : Promise.resolve(0)
      ]).then(function (r) {
        // só eleva o bloqueio; quem derruba é o streaming/expiração
        if (r[0] > ate.d) ate.d = r[0];
        if (r[1] > ate.i) ate.i = r[1];
        atualizar();
      }).catch(function () {});
    }
    checar();
    setInterval(checar, RECHECAR_MS);
  }

  iniciar();
})();
