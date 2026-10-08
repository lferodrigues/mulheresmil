/* Bloqueio temporário de visitantes — páginas públicas
   O administrador bloqueia um visitante pela aba "Visitas ao site" (logs_acesso.html).
   O bloqueio é gravado em bloqueios/{chave} = { ate, ip, did, por, criadoEm } no Realtime Database:
     chave "d_<ID do aparelho>"  -> bloqueia o aparelho/navegador
     chave "i_<IP>"              -> bloqueia o IP (todos os aparelhos daquela rede)
   Esta página consulta, via API REST (sem login), se o aparelho ou o IP está bloqueado e,
   se estiver, cobre a tela com um aviso e uma contagem regressiva. Ao terminar, recarrega.
   Observação: é um bloqueio feito no navegador (a hospedagem é estática); ele impede o uso
   normal do site, mas não substitui um bloqueio no servidor.
   Nunca interrompe a página: se algo falhar, o visitante não é bloqueado. */
(function () {
  "use strict";
  if (window.__mmBloqueio) return;
  window.__mmBloqueio = true;

  var BASE = "https://biblioteca-virtual-8db41-default-rtdb.firebaseio.com/bloqueios/";
  var RECHECAR_MS = 30000;   // reconsulta enquanto a página está aberta
  var mostrando = false;

  function chave(prefixo, valor) {
    return prefixo + String(valor).replace(/[.#$\[\]\/\s]/g, "_");
  }

  function consultar(k) {
    return fetch(BASE + encodeURIComponent(k) + ".json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && Number(j.ate)) || 0; })
      .catch(function () { return 0; });
  }

  function obterIp() {
    try { var c = sessionStorage.getItem("mm_ip"); if (c) return Promise.resolve(c); } catch (e) {}
    return new Promise(function (resolve) {
      var feito = false;
      function fim(ip) { if (feito) return; feito = true; resolve(ip || ""); }
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
    });
  }

  function dois(n) { return (n < 10 ? "0" : "") + n; }

  function mostrar(ate) {
    if (mostrando) return;
    mostrando = true;

    var caixa = document.createElement("div");
    caixa.setAttribute("role", "alertdialog");
    caixa.setAttribute("aria-live", "polite");
    caixa.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "padding:24px;background:rgba(47,16,39,.94);font-family:'Segoe UI',Arial,sans-serif;text-align:center;color:#fff";
    caixa.innerHTML =
      '<div style="max-width:420px;background:#fff;color:#3b2931;border-radius:22px;padding:32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
        '<div style="font-size:48px;line-height:1">🚫</div>' +
        '<h1 style="margin:12px 0 8px;font-size:22px;color:#5a1738">Acesso temporariamente bloqueado</h1>' +
        '<p style="margin:0 0 14px;color:#76656c;font-size:15px;line-height:1.5">Seu acesso a este site foi suspenso por alguns minutos.</p>' +
        '<div style="font-size:34px;font-weight:800;color:#c62828" id="mmBloqTempo">--:--</div>' +
        '<p style="margin:10px 0 0;color:#8a777f;font-size:13px">O site será liberado automaticamente.</p>' +
      '</div>';

    function anexar() {
      document.body.appendChild(caixa);
      document.documentElement.style.overflow = "hidden";
    }
    if (document.body) anexar(); else document.addEventListener("DOMContentLoaded", anexar);

    function tick() {
      var resta = Math.max(0, Math.ceil((ate - Date.now()) / 1000));
      var el = caixa.querySelector("#mmBloqTempo");
      if (el) el.textContent = dois(Math.floor(resta / 60)) + ":" + dois(resta % 60);
      if (resta <= 0) { clearInterval(iv); location.reload(); }
    }
    var iv = setInterval(tick, 1000);
    tick();
  }

  function checar() {
    if (mostrando) return;
    var did = "";
    try { did = localStorage.getItem("mm_device_id") || ""; } catch (e) {}

    Promise.all([
      did ? consultar(chave("d_", did)) : Promise.resolve(0),
      obterIp().then(function (ip) { return ip ? consultar(chave("i_", ip)) : 0; })
    ]).then(function (r) {
      var ate = Math.max(r[0] || 0, r[1] || 0);
      if (ate > Date.now()) mostrar(ate);
    }).catch(function () {});
  }

  checar();
  setInterval(checar, RECHECAR_MS);
})();
