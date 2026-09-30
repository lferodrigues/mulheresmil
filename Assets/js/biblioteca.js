document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".library-button");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.add("clicked");

      setTimeout(() => {
        button.classList.remove("clicked");
      }, 180);
    });
  });
});
