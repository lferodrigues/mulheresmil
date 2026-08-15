// Bloquear botão direito do mouse
document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    alert("Função desabilitada!");
});

// Bloquear teclas de atalho relacionadas a ferramentas de desenvolvedor
document.addEventListener("keydown", (event) => {
    if (
        event.key === "F12" || // F12 para abrir DevTools
        (event.ctrlKey && event.shiftKey && event.key === "I") || // Ctrl+Shift+I
        (event.ctrlKey && event.shiftKey && event.key === "J") || // Ctrl+Shift+J
        (event.ctrlKey && event.key === "U") || // Ctrl+U para visualizar o código-fonte
        (event.ctrlKey && event.key === "S") // Ctrl+S para salvar a página
    ) {
        event.preventDefault();
        alert("Ação bloqueada!");
    }
});

// Tentar detectar o uso das ferramentas de desenvolvedor
(function detectDevTools() {
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function () {
            alert("Ferramentas de desenvolvedor detectadas e bloqueadas!");
            window.location.href = "about:blank"; // Redireciona a página
        }
    });
    console.log('%c', element);
})();
document.addEventListener('keydown', function(event) {
    // Bloqueia Ctrl+S (salvar)
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        alert('A combinação Ctrl+S está desabilitada!');
    }
    // Bloqueia Ctrl+U (ver código-fonte)
    if (event.ctrlKey && event.key === 'u') {
        event.preventDefault();
        alert('A combinação Ctrl+U está desabilitada!');
    }
})
const destination =
  "https://drive.google.com/drive/folders/1KDSAnPJ785LCJZeIIjZPesBlRGBtFNKA?usp=sharing";

const duration = 9000; // 9 segundos
const startTime = performance.now();

const percentage = document.getElementById("percentage");
const progressBar = document.getElementById("progressBar");
const status = document.getElementById("status");
const seconds = document.getElementById("seconds");
const progressTrack = document.querySelector(".progress-track");

const statusMessages = [
  [0, "Iniciando acesso..."],
  [20, "Preparando os materiais..."],
  [45, "Verificando o acesso..."],
  [70, "Carregando a área de materiais..."],
  [90, "Quase pronto..."],
  [100, "Redirecionando..."]
];

function updateStatus(value) {
  let current = statusMessages[0][1];

  for (const [limit, message] of statusMessages) {
    if (value >= limit) current = message;
  }

  status.textContent = current;
}

function animate(currentTime) {
  const elapsed = currentTime - startTime;
  const progress = Math.min(elapsed / duration, 1);
  const value = Math.floor(progress * 100);

  percentage.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
  progressTrack.setAttribute("aria-valuenow", value);

  const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
  seconds.textContent = remaining;

  updateStatus(value);

  if (progress < 1) {
    requestAnimationFrame(animate);
  } else {
    percentage.textContent = "100%";
    progressBar.style.width = "100%";
    status.textContent = "Redirecionando...";
    seconds.textContent = "0";

    window.location.href = destination;
  }
}

requestAnimationFrame(animate);
