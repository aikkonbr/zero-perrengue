# Zero Perrengue 🎯

Sua vida financeira sem aperto. Uma aplicação full-stack de planejamento financeiro para você ter controle total da sua grana e zerar os perrengues.

---

## 🚀 Sobre o Projeto

O **Zero Perrengue** é mais do que um simples extrato bancário; é uma poderosa ferramenta de **previsão e planejamento financeiro**. Construído com uma arquitetura inteligente, ele permite não apenas registrar suas transações, mas também projetar seu futuro financeiro com precisão, levando em conta despesas recorrentes, parcelamentos e o saldo acumulado de meses anteriores.

A interface foi desenhada para ser intuitiva e visualmente agradável, transformando a tarefa, muitas vezes tediosa, de gerenciar finanças em uma experiência mais leve e divertida.

---

## ✨ Funcionalidades Principais

### Visão Geral

*   **Duas Visões Poderosas:** Alterne entre uma **Visão Mensal** detalhada e uma **Visão Panorama** de 12 meses.
*   **Lançamentos Inteligentes:** Um formulário único que se adapta para lançamentos do tipo **Único**, **Parcelado** ou **Recorrente**.
*   **Gerenciamento Completo (CRUD):** Crie, edite e delete contas e transações com facilidade.
*   **Exclusão Contextual:** O sistema entende se você está apagando uma transação única, uma parcela ou uma recorrência, e te dá as opções certas.
*   **Painel de Recorrências:** Um painel central para visualizar e gerenciar todas as suas regras de despesas recorrentes.

### Destaques da Arquitetura

*   **Cálculo de Saldo Acumulado Real:** O backend simula um "fechamento de caixa" mês a mês, garantindo que o saldo anterior (positivo ou negativo) seja corretamente transportado para o período seguinte.
*   **Lógica de Recorrência Perpétua:** Despesas como "Netflix" ou "Aluguel" são salvas como regras, e o sistema as gera dinamicamente para qualquer mês futuro que você visualizar, sem poluir o banco de dados.
*   **Visão Panorama em Cards:** A previsão de 12 meses é apresentada em cards interativos, tornando a análise de dados mais intuitiva e agradável.

---

## 🛠️ Tecnologias Utilizadas

*   **Backend:**
    *   **Node.js**
    *   **Express.js**
*   **Frontend:**
    *   **HTML5**
    *   **CSS3 (Vanilla)** com Flexbox, Grid e Variáveis CSS.
    *   **JavaScript (ES6+)** puro, sem frameworks.
*   **Banco de Dados:**
    *   **Arquivos JSON** para simular um banco de dados simples e portátil.

---

## 🏁 Como Executar o Projeto

Para rodar o "Zero Perrengue" na sua máquina, siga os passos abaixo.

### Pré-requisitos

*   Você precisa ter o **Node.js** instalado (que já inclui o npm). Você pode baixá-lo em [nodejs.org](https://nodejs.org/).

### Instalação e Execução

1.  **Instale as dependências do backend:**
    *   Abra o terminal na pasta do projeto.
    *   Navegue até a pasta do backend: `cd src/backend`
    *   Execute o comando para instalar o Express e o CORS: `npm install`

2.  **Inicie o servidor backend:**
    *   Ainda na pasta `src/backend`, execute: `node server.js`
    *   O terminal deverá mostrar a mensagem: `Servidor rodando em http://localhost:3000`.

3.  **Abra o frontend no navegador:**
    *   Navegue até a pasta `src/frontend`.
    *   Abra o arquivo `index.html` diretamente no seu navegador de preferência (como Chrome, Firefox, etc.).

Pronto! A aplicação estará funcionando e se comunicando com o seu servidor local.
