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
