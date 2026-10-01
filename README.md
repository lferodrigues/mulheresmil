# 🌸 Sistema Mulheres Mil — IF Sudeste MG

<p align="center">
  <img src="Logo-Mulheres-Mil.jpg" alt="Programa Mulheres Mil" width="420">
</p>

<p align="center">
  <strong>Plataforma de apoio educacional para o Programa Mulheres Mil</strong>
</p>

<p align="center">
  <a href="https://www.ifsudestemg.edu.br/" target="_blank">
    IF Sudeste MG
  </a>
  •
  <a href="https://portal.mec.gov.br/programa-mulheres-mil" target="_blank">
    Programa Mulheres Mil
  </a>
</p>

---

## 📚 Sobre o projeto

O **Sistema Mulheres Mil — IF Sudeste MG** foi desenvolvido inicialmente para atender a uma necessidade identificada durante as atividades do Programa Mulheres Mil no município de **São João Nepomuceno — MG**.

A demanda surgiu principalmente com a utilização da **lousa interativa em sala de aula**.

Antes da criação da plataforma, os professores precisavam utilizar computadores próprios, pendrives ou outros dispositivos para acessar e apresentar os materiais utilizados durante as aulas.

A proposta inicial foi, portanto, criar um ambiente web simples, acessível e centralizado, permitindo que os professores pudessem:

* acessar os materiais diretamente pela lousa interativa;
* apresentar os conteúdos sem a necessidade de levar um computador pessoal;
* eliminar a dependência de pendrives para transportar arquivos;
* centralizar os materiais utilizados nas aulas;
* facilitar a organização dos conteúdos dos cursos.

Com a evolução do projeto e a identificação de novas necessidades, a plataforma passou a atender também as **alunas dos cursos**, que podem acessar os materiais das aulas e baixar os arquivos em PDF para continuar os estudos em casa.

Hoje o sistema conta ainda com uma **área administrativa protegida por login**, onde a equipe responsável faz o **lançamento de frequência** e gerencia a **Biblioteca Itinerante** (livros, alunas, reservas, consultas e devoluções).

---

# 🎯 Objetivos

O sistema tem como principais objetivos:

* facilitar o acesso aos materiais didáticos;
* apoiar professores durante as aulas;
* aproveitar a infraestrutura de lousas interativas;
* reduzir a necessidade de dispositivos físicos, como pendrives;
* disponibilizar materiais para estudo fora da sala de aula;
* centralizar os conteúdos dos cursos;
* facilitar o gerenciamento acadêmico;
* auxiliar supervisores e orientação no acompanhamento das turmas;
* registrar e acompanhar faltas das estudantes;
* controlar o acervo, os empréstimos e as devoluções de livros;
* criar uma base tecnológica que possa receber novas funcionalidades.

O projeto foi desenvolvido com uma abordagem **incremental**, sendo ampliado conforme as necessidades identificadas durante a utilização da plataforma.

---

# 🏫 Contexto institucional

O projeto está relacionado às ações do **Programa Mulheres Mil**, desenvolvido no âmbito do **Instituto Federal de Educação, Ciência e Tecnologia do Sudeste de Minas Gerais (IF Sudeste MG)**.

O Programa Mulheres Mil tem como objetivo promover a formação profissional e tecnológica articulada à elevação da escolaridade de mulheres em situação de vulnerabilidade, contribuindo para o acesso à educação, inclusão e autonomia.

No contexto do IF Sudeste MG, o edital de 2026 prevê atuação de profissionais nas funções de orientação e supervisão dos cursos do programa, incluindo atividades relacionadas ao acompanhamento das estudantes, organização de documentos e acompanhamento de frequência.

O sistema foi pensado como uma ferramenta tecnológica de apoio a essas atividades.

---

# 💻 Funcionalidades

## 👩‍🏫 Área pública dos cursos

A página inicial (`index.html`) apresenta os cursos disponíveis e o botão de **Login**.

### 💻 Operadora de Computador

Área destinada aos materiais do curso de **Operadora de Computador**.

### 📚 Assistente Escolar

Área destinada aos materiais do curso de **Assistente Escolar**.

Ao escolher o curso, a usuária vê uma tela de carregamento (`operadora.html` / `assistente.html`) e é redirecionada automaticamente para a pasta de materiais do respectivo curso.

---

## 🖥️ Utilização na lousa interativa

Uma das principais finalidades do sistema é sua utilização diretamente nas **lousas interativas** da escola.

O professor acessa a plataforma pelo navegador e seleciona o curso desejado. Dessa maneira, não é necessário:

* levar notebook pessoal;
* utilizar pendrive;
* copiar arquivos para o computador da sala;
* procurar diferentes arquivos em dispositivos externos.

Essa característica foi o ponto de partida para o desenvolvimento do projeto.

---

## 📥 Materiais para as alunas

Os conteúdos são disponibilizados em formato **PDF**, permitindo que as alunas:

* consultem os materiais;
* estudem posteriormente;
* façam download dos arquivos;
* revisem os conteúdos em casa.

---

## 🔐 Área administrativa

O botão **Login** da página inicial leva à tela `admin.html`, que usa **Firebase Authentication** (e-mail e senha).

Após o login, a usuária acessa o **Painel** (`painel.html`) com duas opções:

| Opção | Descrição |
|---|---|
| 📖 **Biblioteca** | Livros, alunas, reservas, consultas e devoluções |
| 📝 **Lançamento de Frequência** | Controle da lista de presença dos cursos |

As páginas administrativas da biblioteca usam o arquivo `auth-guard.js`: quem não estiver logado é redirecionado automaticamente para a tela de login.

---

## 📊 Controle de frequência

Acessível pelo painel (`menu.html`), com uma lista de presença para cada curso:

* `lista_presenca_mulheres_mil.html` — Operadora de Computador
* `lista_presenca_assistente_escolar.html` — Assistente Escolar

Recursos:

* várias listas por curso, cada uma com **data** e **observação/turma**;
* três aulas por lista, marcando **P** (presente) ou **A** (ausente) para cada aluna;
* aba de **Resumo de Faltas**, somando presenças, faltas e aulas registradas por aluna;
* **exportação em PDF** de todas as listas e do resumo de faltas (jsPDF);
* alunas com faltas destacadas em vermelho.

> ℹ️ As listas de presença guardam os dados no **navegador** (`localStorage`). Os dados ficam disponíveis no mesmo computador/navegador e não são sincronizados entre dispositivos. Recomenda-se baixar os PDFs periodicamente como cópia de segurança.

Esse recurso está alinhado às atividades de acompanhamento atribuídas à função de supervisão no Programa Mulheres Mil.

---

## 📖 Biblioteca Itinerante

A Biblioteca Itinerante organiza o acervo e a circulação de livros entre as participantes do projeto. Os dados ficam no **Firebase Realtime Database** e são atualizados em tempo real. O menu da biblioteca (`biblioteca.html`) reúne cinco áreas:

### 📚 Cadastro de Livros (`cadastro_livros.html`)

* cadastro com código, título, autor(a) e gênero/categoria;
* confirmação antes de salvar;
* se o código já existir, os dados são atualizados **sem alterar a situação** do livro (emprestado/livre);
* clicar em um livro da lista carrega os dados no formulário para edição;
* migração única de livros que estavam salvos apenas no navegador (versão antiga).

### 👩‍🎓 Cadastro de Alunas (`cadastro_alunos.html`)

* seleção do curso e pesquisa da aluna pelo nome (a lista vem das listas de presença);
* registro do **WhatsApp** para contato, com máscara automática;
* lista de **alunas cadastradas** do curso, com botão **Remover** em cada uma;
* a remoção pede **confirmação** e é **bloqueada** se a aluna ainda estiver com livro emprestado (é preciso registrar antes a devolução).

### 📖 Reserva de Livros (`reserva_livros.html`)

* busca por livro (somente disponíveis) e por aluna cadastrada;
* confirmação com data da reserva e **prazo de devolução de 15 dias**;
* reserva feita por **transação atômica**, evitando que duas pessoas reservem o mesmo livro ao mesmo tempo;
* lista dos livros emprestados, com destaque para os atrasados;
* grava o histórico do empréstimo (quem, qual livro e quando).

### 🔎 Consulta de Livros (`consulta-livros.html`)

* filtro por número/código e por título;
* situação de cada livro:
  * 🟢 **Livre** — disponível;
  * 🟡 **Emprestado** — dentro do prazo de 15 dias;
  * 🔴 **Atrasado** — passou de 15 dias da reserva;
* botão **Expandir** com os detalhes do livro e para quem está reservado.

### ↩️ Devolução de Livros (`devolucao_livros.html`)

* layout idêntico ao da Consulta de Livros, listando apenas os livros **emprestados ou atrasados**;
* no lugar do "Expandir", o botão **Remover**;
* ao clicar, abre um pop-up perguntando se a pessoa deseja realmente fazer a alteração;
* confirmando, o livro volta ao status **🟢 Livre**, os dados da aluna são limpos e o empréstimo fica registrado como **devolvido**, com a data da devolução.

---

# 🧩 Estrutura atual

```text
Sistema Mulheres Mil
│
├── Área pública
│   ├── index.html ................. Escolha do curso + botão Login
│   ├── operadora.html ............. Redireciona aos materiais (Operadora)
│   └── assistente.html ............ Redireciona aos materiais (Assistente)
│
├── Área administrativa (login)
│   ├── admin.html ................. Login (Firebase Authentication)
│   ├── painel.html ................ Biblioteca | Lançamento de Frequência
│   │
│   ├── Frequência
│   │   ├── menu.html .............. Escolha do curso
│   │   ├── lista_presenca_mulheres_mil.html
│   │   └── lista_presenca_assistente_escolar.html
│   │
│   └── Biblioteca Itinerante
│       ├── biblioteca.html ........ Menu da biblioteca
│       ├── cadastro_livros.html
│       ├── cadastro_alunos.html
│       ├── reserva_livros.html
│       ├── consulta-livros.html
│       └── devolucao_livros.html
│
└── Assets
    ├── css/ ....................... Estilos de cada página
    └── js/ ........................ Scripts (firebase-config, auth-guard, etc.)
```

### Banco de dados (Firebase Realtime Database)

```text
/livros/{codigo}        → dados do livro, status, reservado, aluna, datas
/alunas/{curso}/{n}     → nome, nº da chamada, WhatsApp
/emprestimos/{id}       → livro, aluna, data da reserva, prazo, status
```

---

# 🛠️ Tecnologias

O projeto foi desenvolvido com tecnologias web, executando diretamente no navegador.

* **HTML5**
* **CSS3**
* **JavaScript** (módulos ES)
* **Firebase Authentication** — login da área administrativa
* **Firebase Realtime Database** — dados da Biblioteca Itinerante
* **jsPDF** e **jsPDF-AutoTable** — exportação das listas de presença em PDF
* **GitHub Pages** — hospedagem (domínio `mulheresmil.com.br`)

---

# 📱 Responsividade

A plataforma utiliza a configuração:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

permitindo adaptação da interface para:

* 🖥️ computadores;
* 🖥️ lousas interativas;
* 💻 notebooks;
* 📱 smartphones;
* 📱 tablets.

---

# 🎨 Interface

A identidade visual utiliza elementos associados ao **Programa Mulheres Mil**, com uma apresentação simples, institucional e de fácil utilização:

* cartões de conteúdo e botões de acesso;
* ícones para identificação das áreas;
* layout centralizado e responsivo;
* paleta de **laranja e verde** na área pública e de **laranja e vinho** na Biblioteca Itinerante;
* pop-ups de confirmação antes de ações importantes (salvar, reservar, devolver e remover).

---

# 🏛️ Identidade institucional

As logomarcas oficiais do IF Sudeste MG estão disponíveis na página oficial de identidade visual do instituto:

**IF Sudeste MG — Identidade Visual**

https://www.ifsudestemg.edu.br/comunicacao-social/logos

A documentação oficial da identidade visual do **Programa Mulheres Mil** pode ser encontrada no portal do Ministério da Educação:

https://www.gov.br/mec/pt-br/centrais-de-conteudo/marcas/educacao-profissional-e-tecnologica/mulheres-mil/documentos

---

# 🔄 Evolução do projeto

### Fase 1 — Necessidade em sala de aula

Identificação da necessidade de utilização da lousa interativa sem depender de computadores pessoais ou pendrives.

⬇️

### Fase 2 — Centralização dos materiais

Criação de páginas para organização dos materiais dos cursos.

⬇️

### Fase 3 — Acesso das estudantes

Disponibilização dos materiais para que as alunas pudessem baixar e estudar em casa.

⬇️

### Fase 4 — Área administrativa

Criação de uma área protegida por login (Firebase Authentication) para supervisores e orientação.

⬇️

### Fase 5 — Controle acadêmico

Implementação das listas de presença, do resumo de faltas e da exportação em PDF.

⬇️

### Fase 6 — Biblioteca Itinerante

Cadastro de livros e alunas, reservas com prazo de 15 dias, consulta com situação (livre, emprestado e atrasado) e **devolução de livros**, tudo integrado ao Firebase.

⬇️

### Fase 7 — Evolução contínua

O sistema continuará recebendo atualizações de acordo com as necessidades identificadas durante a execução dos cursos.

---

# 🚀 Próximas atualizações

O projeto possui caráter evolutivo. Novas funcionalidades poderão ser adicionadas conforme as necessidades dos professores, estudantes, supervisores e orientação.

**Já implementado**

* [x] login administrativo com Firebase Authentication;
* [x] cadastro de livros;
* [x] cadastro de alunas na Biblioteca Itinerante;
* [x] remoção do cadastro de alunas;
* [x] reserva de livros com prazo de devolução;
* [x] consulta de livros com situação (livre, emprestado, atrasado);
* [x] registro de devolução de livros;
* [x] listas de presença por curso;
* [x] resumo de faltas;
* [x] exportação das listas e do resumo em PDF;
* [x] melhorias para dispositivos móveis.

**Ideias futuras**

* [ ] salvar a frequência no Firebase (hoje fica no navegador);
* [ ] proteger também as páginas de lista de presença com login;
* [ ] histórico de empréstimos por aluna e por livro;
* [ ] aviso (por exemplo, via WhatsApp) para livros atrasados;
* [ ] excluir livros do acervo;
* [ ] cadastro de professores e de turmas;
* [ ] relatórios de frequência e histórico de faltas;
* [ ] gerenciamento e upload de materiais em PDF;
* [ ] organização dos materiais por disciplina;
* [ ] calendário de aulas;
* [ ] comunicados para as estudantes;
* [ ] diferentes níveis de acesso;
* [ ] melhorias de acessibilidade;
* [ ] sistema de notificações.

> A implementação dessas funcionalidades dependerá das necessidades identificadas durante a utilização da plataforma.

---

# 🔐 Segurança

O acesso à área administrativa é feito por login com **Firebase Authentication**, e as páginas da biblioteca são protegidas pelo `auth-guard.js`.

Pontos de atenção:

* a configuração do Firebase presente no código é pública por natureza; **a proteção real dos dados está nas Regras do Realtime Database**, que devem permitir leitura e escrita apenas para usuários autenticados;
* o domínio `mulheresmil.com.br` deve estar em *Authentication → Settings → Authorized domains* no Firebase;
* o bloqueio do botão direito e dos atalhos de desenvolvedor nas páginas públicas é apenas um desestímulo e **não** substitui a segurança do servidor;
* as listas de presença ficam no `localStorage` do navegador.

Como o sistema trabalha com informações acadêmicas e dados de estudantes (nomes e WhatsApp), futuras versões deverão priorizar:

* controle de permissões por perfil;
* registro de alterações;
* gerenciamento de sessões;
* proteção contra acesso não autorizado;
* adequação à **LGPD** (Lei Geral de Proteção de Dados).

---

# 👥 Público-alvo

### 👩‍🎓 Estudantes

Acesso aos materiais didáticos e PDFs das aulas, além de empréstimo de livros pela Biblioteca Itinerante.

### 👨‍🏫 Professores

Acesso aos conteúdos para utilização durante as aulas e na lousa interativa.

### 👩‍💼 Supervisores

Acompanhamento das turmas, controle de frequência e gestão da biblioteca.

### 👩‍💼 Orientação

Acompanhamento acadêmico e apoio à gestão das estudantes e dos cursos.

---

# 📍 Local de desenvolvimento e utilização

**São João Nepomuceno — Minas Gerais, Brasil**

O projeto foi inicialmente concebido para atender às necessidades identificadas no contexto do **Programa Mulheres Mil — IF Sudeste MG**, no campus de São João Nepomuceno.

---

# 👨‍💻 Desenvolvimento

**Felipe Rodrigues**

Especialista em Tecnologia da Informação

🌐 **Portfólio:**
https://feliperodrigues.net

---

# 🏛️ Instituições relacionadas

### Programa Mulheres Mil

Programa do Ministério da Educação voltado à formação profissional e tecnológica de mulheres, articulada à elevação da escolaridade e à inclusão social.

🌐 https://portal.mec.gov.br/programa-mulheres-mil

### IF Sudeste MG

Instituto Federal de Educação, Ciência e Tecnologia do Sudeste de Minas Gerais.

🌐 https://www.ifsudestemg.edu.br/

---

# 📌 Status do projeto

**Status:** 🟢 Em desenvolvimento contínuo

O sistema encontra-se em evolução e novas funcionalidades poderão ser incorporadas conforme as necessidades do Programa Mulheres Mil e da equipe responsável pelos cursos.

---

# 📄 Licença

Este projeto foi desenvolvido especificamente para apoiar as atividades educacionais e administrativas relacionadas ao Programa Mulheres Mil.

A definição de licença, distribuição e reutilização do código deverá ser estabelecida pelo responsável pelo projeto e/ou pela instituição responsável pela sua utilização.

---

<p align="center">
  <strong>Mulheres Mil • Educação, Cidadania e Desenvolvimento Sustentável</strong>
</p>

<p align="center">
  Desenvolvido por <strong>Felipe Rodrigues</strong>
</p>
