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

Hoje o sistema conta ainda com uma **área administrativa protegida por login**, onde a equipe responsável faz o **lançamento de frequência**, gerencia a **Biblioteca Itinerante** (livros, alunas, reservas, consultas e devoluções), cadastra **novos usuários** e consulta os **logs de acesso** ao sistema.

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
* registrar quem acessa o sistema e quando (rastreabilidade);
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

Após o login, a usuária passa por uma tela de carregamento animada (`carregando.html`) e acessa o **Painel** (`painel.html`) com três opções:

| Opção | Descrição |
|---|---|
| 📖 **Biblioteca** | Livros, alunas, reservas, consultas e devoluções |
| 📝 **Lançamento de Frequência** | Controle da lista de presença dos cursos |
| 🔒 **Logs de Acesso** | Área restrita com o histórico de acessos ao sistema |

As páginas administrativas usam o arquivo `auth-guard.js`: quem não estiver logado é redirecionado automaticamente para a tela de login.

---

## 👤 Cadastro de novos usuários

Na tela de login há o botão **👤 Cadastrar novo usuário**. O fluxo é:

1. ao clicar, abre um pop-up pedindo o **login e a senha de administrador**;
2. se estiverem corretos, a pessoa é levada para `cadastro.html`; se não, aparece o pop-up **Acesso negado**;
3. no cadastro, são informados:
   * **Nome**
   * **Sobrenome**
   * **WhatsApp** (com máscara automática e validação de DDD)
   * **E-mail**
   * **Senha** e confirmação (com botão de mostrar/ocultar);
4. a conta é criada no **Firebase Authentication** e os dados são gravados no **Realtime Database**, em `usuarios/{uid}`;
5. o cadastro é registrado nos logs de acesso e a usuária é redirecionada pela tela de carregamento.

> As credenciais de administrador **não ficam em texto puro** no código: apenas o hash SHA-256 de `sal|e-mail|senha`.

---

## 🧾 Logs de acesso

O sistema registra, no **Realtime Database**, os seguintes eventos:

| Evento | Quando é gravado |
|---|---|
| `login` | quando a usuária entra pela tela `admin.html` (também atualiza o `ultimoAcesso` do perfil) |
| `logout` | quando clica em **Sair** (gravado antes de encerrar a sessão) |
| `cadastro` | quando um novo usuário é criado |

Cada registro guarda: `uid`, `email`, `tipo`, `pagina`, `data` (horário do servidor) e `navegador`.

A gravação é centralizada em `Assets/js/logs-acesso.js` (função `registrarLog`). Ela **nunca interrompe** o fluxo do sistema: se a gravação falhar, apenas registra o erro no console.

### 🔒 Página de logs (`logs_acesso.html`)

Acessada pelo botão **Logs de Acesso** do painel.

* a página abre **bloqueada** (cadeado);
* ao clicar em **Acessar logs**, um pop-up personalizado pede e-mail e senha;
* a senha também fica protegida por **hash SHA-256**, com bloqueio de 30 segundos após 5 tentativas erradas;
* depois de liberada, mostra a tabela com **data/hora, tipo, e-mail, página e navegador**;
* possui **busca** (e-mail/página), **filtro por tipo** e botão **Atualizar**;
* o botão **⬇️ Salvar em PDF** exporta em paisagem exatamente o que está na tela (já filtrado), com data de geração e numeração de páginas;
* ao recarregar, a página volta a ficar bloqueada.

> ⚠️ O pop-up é uma barreira de interface. A proteção real dos dados está nas **Regras do Realtime Database** (veja a seção *Segurança*).

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
* botão **Remover** em cada livro, com confirmação — **bloqueado** se o livro estiver emprestado;
* migração única de livros que estavam salvos apenas no navegador (versão antiga).

### 👩‍🎓 Cadastro de Alunas (`cadastro_alunos.html`)

* seleção do curso e pesquisa da aluna pelo nome (a lista vem das listas de presença);
* registro do **WhatsApp** para contato, com máscara automática;
* lista de **alunas cadastradas** do curso, com botão **Remover** em cada uma;
* a remoção pede **confirmação** e é **bloqueada** se a aluna ainda estiver com livro emprestado (é preciso registrar antes a devolução);
* botão **📄 Importar alunas de planilha** (veja abaixo).

### 📄 Importar Alunas (`importar_alunas.html`)

* envio de uma ou mais planilhas de lista de presença (`.xlsx`, `.xls` ou `.csv`), por clique ou arrastando os arquivos;
* leitura automática do **curso**, do **número da chamada** e do **nome** de cada aluna (biblioteca SheetJS);
* pré-visualização com a situação de cada linha: **nova**, **já cadastrada**, **nome diferente**, **nº repetido** ou **sem curso**;
* opção de atualizar o nome quando o número já existir com outro nome (o **WhatsApp é sempre mantido**);
* confirmação com resumo antes de gravar em `alunas/{curso}/{nº}`.

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

### 🔔 Sino de notificações de atraso

Um sino aparece nas páginas da biblioteca (menu, reserva, consulta e importação), criado automaticamente por `notificacoes.js`:

* mostra a **quantidade de livros atrasados** e fica vermelho (e "toca") quando há atrasos;
* ao abrir, lista aluna, livro e dias de atraso;
* ao clicar em um atraso, abre um pop-up com o **WhatsApp da aluna** e o botão **💬 Enviar mensagem**, que abre o WhatsApp com uma mensagem de cobrança já pronta;
* se a aluna não tiver WhatsApp cadastrado, o sistema avisa e orienta a cadastrar;
* a contagem é atualizada em tempo real e a cada minuto (quando o dia vira).

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
│   ├── admin.html ................. Login + cadastrar novo usuário (pop-up de administrador)
│   ├── cadastro.html .............. Cadastro de usuário (nome, sobrenome, WhatsApp, e-mail, senha)
│   ├── carregando.html ............ Animação pós-login
│   ├── painel.html ................ Biblioteca | Frequência | Logs de Acesso
│   ├── logs_acesso.html ........... Logs de acesso (pop-up de senha + PDF)
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
│       ├── importar_alunas.html
│       ├── reserva_livros.html
│       ├── consulta-livros.html
│       └── devolucao_livros.html
│
└── Assets
    ├── css/ ....................... Estilos de cada página
    └── js/
        ├── firebase-config.js ..... Configuração única do Firebase (módulo)
        ├── auth-guard.js .......... Proteção de páginas + log de logout
        ├── logs-acesso.js ......... Gravação dos logs de acesso
        ├── notificacoes.js ........ Sino de atrasos + aviso por WhatsApp
        └── (demais scripts de cada página)
```

### Banco de dados (Firebase Realtime Database)

```text
/livros/{codigo}        → dados do livro, status, reservado, aluna, datas
/alunas/{curso}/{n}     → nome, nº da chamada, WhatsApp
/emprestimos/{id}       → livro, aluna, data da reserva, prazo, status
/usuarios/{uid}         → nome, sobrenome, email, whatsapp, criadoEm, ultimoAcesso
/logsAcesso/{id}        → uid, email, tipo (login | logout | cadastro), pagina, data, navegador
```

### Regras do Realtime Database

```json
{
  "rules": {
    "livros": {
      ".read": true,
      ".write": "auth != null"
    },
    "alunas": { ".read": "auth != null", ".write": "auth != null" },
    "emprestimos": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["livroId", "alunaId", "status"]
    },
    "presenca": { ".read": "auth != null", ".write": "auth != null" },
    "usuarios": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "logsAcesso": {
      ".read": "auth != null && auth.token.email === 'contato@feliperodrigues.net'",
      "$id": {
        ".write": "auth != null && !data.exists()",
        ".validate": "newData.child('uid').val() === auth.uid"
      }
    },
    "config": { ".read": true, ".write": "auth != null" }
  }
}
```

* **`usuarios`**: cada usuária lê e grava apenas o próprio perfil;
* **`logsAcesso`**: os registros só podem ser **criados** (nunca editados ou apagados) e cada um precisa carregar o `uid` de quem o gravou; a **leitura** é restrita à conta do administrador.

---

# 🛠️ Tecnologias

O projeto foi desenvolvido com tecnologias web, executando diretamente no navegador.

* **HTML5**
* **CSS3**
* **JavaScript** (módulos ES)
* **Firebase Authentication** — login e cadastro de usuários
* **Firebase Realtime Database** — Biblioteca Itinerante, perfis de usuários e logs de acesso
* **jsPDF** e **jsPDF-AutoTable** — exportação das listas de presença e dos logs em PDF
* **SheetJS (xlsx)** — leitura das planilhas na importação de alunas
* **Web Crypto API (SHA-256)** — verificação das credenciais de administrador sem guardar senha em texto puro
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
* paleta de **laranja e verde** na área pública e de **laranja e vinho** na Biblioteca Itinerante e nos logs;
* pop-ups de confirmação antes de ações importantes (salvar, reservar, devolver, remover e acessar áreas restritas).

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

Cadastro de livros e alunas, importação de planilhas, reservas com prazo de 15 dias, consulta com situação (livre, emprestado e atrasado), **devolução de livros** e **aviso de atrasos por WhatsApp**, tudo integrado ao Firebase.

⬇️

### Fase 7 — Usuários e rastreabilidade

Cadastro de novos usuários com nome, sobrenome e WhatsApp, perfis salvos no banco, **logs de acesso** (login, logout e cadastro) e página restrita para consulta e exportação dos logs em PDF.

⬇️

### Fase 8 — Evolução contínua

O sistema continuará recebendo atualizações de acordo com as necessidades identificadas durante a execução dos cursos.

---

# 🚀 Próximas atualizações

O projeto possui caráter evolutivo. Novas funcionalidades poderão ser adicionadas conforme as necessidades dos professores, estudantes, supervisores e orientação.

**Já implementado**

* [x] login administrativo com Firebase Authentication;
* [x] cadastro de novos usuários (nome, sobrenome, WhatsApp, e-mail) protegido por credencial de administrador;
* [x] perfis de usuários salvos no Realtime Database;
* [x] logs de acesso (login, logout e cadastro);
* [x] página de logs com pop-up de senha, filtros e exportação em PDF;
* [x] cadastro de livros e remoção de livros do acervo;
* [x] cadastro de alunas na Biblioteca Itinerante;
* [x] importação de alunas por planilha (.xlsx/.xls/.csv);
* [x] remoção do cadastro de alunas;
* [x] reserva de livros com prazo de devolução;
* [x] consulta de livros com situação (livre, emprestado, atrasado);
* [x] registro de devolução de livros;
* [x] aviso de livros atrasados por sino de notificações, com mensagem de cobrança pelo WhatsApp;
* [x] listas de presença por curso;
* [x] resumo de faltas;
* [x] exportação das listas e do resumo em PDF;
* [x] melhorias para dispositivos móveis.

**Ideias futuras**

* [ ] salvar a frequência no Firebase (hoje fica no navegador);
* [ ] proteger também as páginas de lista de presença com login;
* [ ] verificar a credencial de administrador também dentro de `cadastro.html`;
* [ ] tela de administração de usuários (listar, desativar, redefinir senha);
* [ ] registrar também as páginas visitadas e tentativas de login com falha (exige função no servidor);
* [ ] histórico de empréstimos por aluna e por livro;
* [ ] cadastro de professores e de turmas;
* [ ] relatórios de frequência e histórico de faltas;
* [ ] gerenciamento e upload de materiais em PDF;
* [ ] organização dos materiais por disciplina;
* [ ] calendário de aulas;
* [ ] comunicados para as estudantes;
* [ ] diferentes níveis de acesso (perfis);
* [ ] melhorias de acessibilidade.

> A implementação dessas funcionalidades dependerá das necessidades identificadas durante a utilização da plataforma.

---

# 🔐 Segurança

O acesso à área administrativa é feito por login com **Firebase Authentication**, e as páginas da biblioteca, o painel e os logs são protegidos pelo `auth-guard.js`.

Pontos de atenção:

* a configuração do Firebase presente no código é pública por natureza; **a proteção real dos dados está nas Regras do Realtime Database** (veja a seção *Regras*), que devem permitir leitura e escrita apenas para usuários autenticados e, no caso dos logs, apenas para a conta do administrador;
* o domínio `mulheresmil.com.br` deve estar em *Authentication → Settings → Authorized domains* no Firebase;
* as **credenciais de administrador** (cadastro de usuários e logs) são verificadas no navegador por **hash SHA-256**: a senha não aparece no código, mas a verificação é uma **barreira de interface** e não substitui as regras do servidor;
* para consultar os logs, é preciso estar logado com a conta autorizada na regra `logsAcesso` (`auth.token.email`); essa conta deve existir no Firebase Authentication;
* `cadastro.html` ainda não confere o acesso de administrador por conta própria (o `admin.html` apenas redireciona para ele); essa verificação está na lista de ideias futuras;
* os logs **não registram tentativas de login com falha**, pois o banco só aceita gravação de usuários autenticados;
* o bloqueio do botão direito e dos atalhos de desenvolvedor nas páginas é apenas um desestímulo e **não** substitui a segurança do servidor;
* as listas de presença ficam no `localStorage` do navegador;
* recomenda-se **trocar periodicamente** as senhas de administrador e nunca compartilhá-las em canais abertos.

Como o sistema trabalha com informações acadêmicas e dados pessoais (nomes, e-mails, WhatsApp e registros de acesso), futuras versões deverão priorizar:

* controle de permissões por perfil;
* gerenciamento de sessões;
* proteção contra acesso não autorizado;
* definição de prazo de retenção dos logs;
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

### 🛡️ Administrador

Cadastro de novos usuários e consulta dos logs de acesso do sistema.

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
