document.addEventListener('DOMContentLoaded', () => {
  // const apiUrl = 'http://localhost:3000/api';
  const apiUrl = 'https://zero-perrengue.onrender.com/api';
  // --- Views ---
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  // --- UI Elements ---
  const summaryBar = document.getElementById('summary-bar');
  const monthlyView = document.getElementById('monthly-view');
  const panoramaView = document.getElementById('panorama-view');
  const accountsListDiv = document.getElementById('accounts-list');
  const userProfileDiv = document.getElementById('user-profile');
  const userNameSpan = document.getElementById('user-name');

  // --- Buttons ---
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // --- Modals & Forms ---
  const accountModal = document.getElementById('account-modal');
  const addTransactionModal = document.getElementById('add-transaction-modal');
  const editTransactionModal = document.getElementById('edit-transaction-modal');
  const deleteConfirmationModal = document.getElementById('delete-confirmation-modal');
  const manageRecurringModal = document.getElementById('manage-recurring-modal');

  const accountForm = document.getElementById('account-form');
  const addTransactionForm = document.getElementById('add-transaction-form');
  const editTransactionForm = document.getElementById('edit-transaction-form');

  // --- App State & Definitions ---
  let selectedYear = new Date().getFullYear();
  let selectedMonth = new Date().getMonth() + 1;
  let transactionToDelete = {};

  const accountTypeOptions = [
      { value: 'CARTAO_DE_CREDITO', label: 'Crédito', icon: '💳' },
      { value: 'DIVIDA_FIXA', label: 'Dívida Fixa', icon: '🧾' },
      { value: 'PROVENTO', label: 'Provento', icon: '💵' },
      { value: 'OUTRO', label: 'Outro', icon: '📁' }
  ];

  // --- Core Functions ---

  const getAccountTypeIcon = (type) => {
    const option = accountTypeOptions.find(opt => opt.value === type);
    return option ? option.icon : '📁';
  };

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const createCardSelector = (container, options, hiddenInput, callback) => {
    container.innerHTML = '';
    options.forEach(option => {
      const card = document.createElement('div');
      card.className = 'selector-card';
      card.dataset.value = option.value;
      card.innerHTML = `<div class="card-icon">${option.icon}</div><div class="card-label">${option.label}</div>`;
      container.appendChild(card);
    });
    container.addEventListener('click', (event) => {
      const selectedCard = event.target.closest('.selector-card');
      if (!selectedCard) return;
      container.querySelectorAll('.selector-card').forEach(card => card.classList.remove('active'));
      selectedCard.classList.add('active');
      hiddenInput.value = selectedCard.dataset.value;
      if (callback) callback(selectedCard.dataset.value);
    });
  };

  const renderDynamicTransactionFields = (type, prefix = '') => {
    const container = document.getElementById(`${prefix}dynamic-transaction-fields`);
    if (!container) return;

    const valueId = `${prefix}transaction-value`;
    const installmentValueId = `${prefix}installment-value`;
    const numberOfInstallmentsId = `${prefix}number-of-installments`;

    let html = '';
    if (type === 'single' || type === 'recurring') {
      const label = type === 'single' ? 'Valor' : 'Valor Mensal';
      html = `<div class="form-group"><label for="${valueId}">${label}</label><input type="number" id="${valueId}" step="0.01" required></div>`;
    } else if (type === 'installment') {
      html = `<div class="form-row">
                <div class="form-group"><label for="${installmentValueId}">Valor da Parcela</label><input type="number" id="${installmentValueId}" step="0.01" required></div>
                <div class="form-group"><label for="${numberOfInstallmentsId}">Nº de Parcelas</label><input type="number" id="${numberOfInstallmentsId}" required></div>
              </div>`;
    }
    container.innerHTML = html;
  };

  const populateAccountsDropdown = async (selectElement, selectedAccountId) => {
      selectElement.innerHTML = '<option value="" disabled>Selecione uma conta</option>';
      const accountsResponse = await fetch(`${apiUrl}/accounts`);
      const accounts = await accountsResponse.json();
      accounts.forEach(account => selectElement.appendChild(new Option(account.name, account.id)));
      if (selectedAccountId) {
          selectElement.value = selectedAccountId;
      }
  };

  const populateDateNavigation = async () => {
    const monthTabsContainer = document.getElementById('month-tabs-container');
    const yearSelectorCards = document.getElementById('year-selector-cards');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    monthTabsContainer.innerHTML = months.map((month, index) => `<button class="month-tab" data-month="${index + 1}">${month}</button>`).join('');
    const allTransactionsResponse = await fetch(`${apiUrl}/transactions`);
    const allTransactions = await allTransactionsResponse.json();
    const years = new Set(allTransactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    yearSelectorCards.innerHTML = Array.from(years).sort((a, b) => a - b).map(year => `<button class="year-card" data-year="${year}">${year}</button>`).join('');
    updateActiveDateButtons();
  };

  const updateActiveDateButtons = () => {
    document.querySelectorAll('.year-card').forEach(card => card.classList.toggle('active', card.dataset.year == selectedYear));
    document.querySelectorAll('.month-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.month == selectedMonth));
  };

  const renderMonthlyView = async () => {
    if (!selectedMonth || !selectedYear) return;
    try {
        const balanceResponse = await fetch(`${apiUrl}/summary/opening-balance?month=${selectedMonth}&year=${selectedYear}`);
        if (!balanceResponse.ok) throw new Error('Falha ao buscar saldo anterior.');
        const data = await balanceResponse.json();
        if (data.openingBalance === undefined) {
            console.error("API Response Error:", data);
            throw new Error("A resposta da API para o saldo anterior é inválida.");
        }
        const { openingBalance } = data;

        const accountsResponse = await fetch(`${apiUrl}/accounts`);
        const accounts = await accountsResponse.json();
        accountsListDiv.innerHTML = '';

        let totalProventos = 0, totalDespesas = 0;
        const transactionUrl = `${apiUrl}/transactions?month=${selectedMonth}&year=${selectedYear}`;

        for (const account of accounts) {
            const response = await fetch(`${transactionUrl}&accountId=${account.id}`);
            const transactions = await response.json();
            const accountContainer = document.createElement('div');
            accountContainer.className = 'account-container';

            const totalValue = transactions.reduce((sum, t) => sum + t.value, 0);
            const isProvento = account.type === 'PROVENTO';
            if (isProvento) totalProventos += totalValue; else totalDespesas += totalValue;

            const header = document.createElement('div');
            header.className = 'account-header';
            const icon = getAccountTypeIcon(account.type);
            header.innerHTML = `
                <div class="account-title">
                    <span class="account-icon">${icon}</span>
                    <h3>${account.name}</h3>
                    <button class="edit-account-btn" data-id="${account.id}" data-name="${account.name}" data-type="${account.type}">&#9998;</button>
                </div>
                <strong class="${isProvento ? 'income' : 'expense'}">${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            `;

            const body = document.createElement('div');
            body.className = 'account-card-body';

            if (transactions.length > 0) {
                const transactionList = document.createElement('ul');
                transactionList.className = 'transaction-list';
                transactions.forEach(t => {
                    const item = document.createElement('li');
                    const isRecurring = t.transactionType === 'recurring';
                    const isInstallment = t.transactionType === 'installment';

                    item.innerHTML = `
                        <div class="transaction-details"><span>${t.description}</span><span class="${isProvento ? 'income' : 'expense'}">${t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                        <div class="transaction-actions">
                            ${!isRecurring ? `<button class="edit-transaction-btn" data-id="${t.id}">&#9998;</button>` : ''}
                            <button class="delete-btn" 
                                data-id="${t.id}" 
                                data-type="${t.transactionType}" 
                                data-purchase-id="${isInstallment ? t.purchaseId : ''}">
                                &#x1F5D1;
                            </button>
                        </div>
                    `;
                    transactionList.appendChild(item);
                });
                body.appendChild(transactionList);
            } else {
                body.innerHTML = '<div class="no-transactions">Nenhuma transação este mês.</div>';
            }

            const footer = document.createElement('div');
            footer.className = 'account-footer';
            footer.innerHTML = `<button class="add-transaction-to-account-btn" data-account-id="${account.id}">+</button>`;

            accountContainer.append(header, body, footer);
            accountsListDiv.appendChild(accountContainer);
        }

        const saldoFinal = openingBalance + totalProventos - totalDespesas;
        summaryBar.innerHTML = `
            <div class="summary-item"><span class="label">SALDO ANTERIOR</span><span class="value ${openingBalance >= 0 ? 'income' : 'expense'}">${openingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="summary-operator">+</div>
            <div class="summary-item"><span class="label">(+) PROVENTOS</span><span class="value income">${totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="summary-operator">-</div>
            <div class="summary-item"><span class="label">(-) DESPESAS</span><span class="value expense">${totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            <div class="summary-operator">=</div>
            <div class="summary-item"><span class="label">SALDO FINAL</span><span class="value total ${saldoFinal >= 0 ? 'income' : 'expense'}">${saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
        `;
    } catch (error) { 
        summaryBar.innerHTML = '<div style="color: red; width: 100%; text-align: center;">Erro ao carregar resumo.</div>';
        accountsListDiv.innerHTML = `<p style="color: red;">Erro ao carregar dados: ${error.message}</p>`; 
        console.error(error);
    }
};

  const renderPanoramaView = async () => {
    const panoramaGrid = document.getElementById('panorama-card-grid');
    try {
        const response = await fetch(`${apiUrl}/panorama`);
        if (!response.ok) throw new Error('Falha ao carregar dados do panorama.');
        const monthlyData = await response.json();

        panoramaGrid.innerHTML = '';

        monthlyData.forEach(data => {
            const card = document.createElement('div');
            card.className = 'panorama-card';

            const saldoMesClass = data.saldoMes >= 0 ? 'income' : 'expense';
            const saldoAcumuladoClass = data.saldoAcumulado >= 0 ? 'income' : 'expense';
            const balanceIcon = data.saldoMes >= 0 ? '📈' : '📉';

            const detailsHTML = data.accountDetails.length > 0 ? 
                data.accountDetails.map(acc => `
                    <li class="${acc.accountType === 'PROVENTO' ? 'income' : 'expense'}">
                        <span>${acc.accountName}</span>
                        <span>${acc.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </li>
                `).join('') :
                '<li>Nenhuma movimentação registrada.</li>';

            card.innerHTML = `
                <div class="panorama-card-header"><h3>${data.month}</h3></div>
                <div class="panorama-card-body">
                    <div class="month-balance"><span class="balance-label">Balanço do Mês</span><span class="balance-value ${saldoMesClass}">${data.saldoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ${balanceIcon}</span></div>
                    <div class="month-summary">
                        <div class="summary-detail income"><span class="label">(+) Proventos</span><span>${data.totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                        <div class="summary-detail expense"><span class="label">(-) Despesas</span><span>${data.totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>
                    <div class="account-details-container hidden"><h4>Detalhes por Conta</h4><ul class="account-details-list">${detailsHTML}</ul></div>
                </div>
                <div class="panorama-card-footer">
                    <button class="details-toggle-btn">Ver Detalhes</button>
                    <div class="cumulative-balance"><span class="label">Saldo Acumulado</span><span class="value ${saldoAcumuladoClass}">${data.saldoAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
            `;
            panoramaGrid.appendChild(card);
        });

    } catch (error) {
        panoramaGrid.innerHTML = `<p style="color: red; text-align: center;">Erro ao carregar panorama: ${error.message}</p>`;
        console.error(error);
    }
};

  const renderRecurringRules = async () => {
    const list = document.getElementById('recurring-rules-list');
    try {
      const response = await fetch(`${apiUrl}/recurring-transactions`);
      const rules = await response.json();
      list.innerHTML = '';
      if (rules.length === 0) {
        list.innerHTML = '<li class="list-item-empty">Nenhuma regra de recorrência encontrada.</li>';
        return;
      }
      rules.forEach(rule => {
        const item = document.createElement('li');
        item.className = 'list-item';
        item.innerHTML = `
          <div class="item-details">
            <span class="item-description">${rule.description}</span>
            <span class="item-value">${rule.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span class="item-account">${rule.accountName} (Todo dia ${rule.dayOfMonth})</span>
          </div>
          <button class="delete-rule-btn" data-id="${rule.id}">&#x1F5D1;</button>
        `;
        list.appendChild(item);
      });
    } catch (error) {
      list.innerHTML = '<li class="list-item-empty" style="color: red;">Erro ao carregar regras.</li>';
      console.error(error);
    }
  };

  const switchView = (view) => {
    document.querySelectorAll('.view-switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    monthlyView.classList.toggle('hidden', view !== 'monthly');
    panoramaView.classList.toggle('hidden', view !== 'panorama');
    summaryBar.classList.toggle('hidden', view === 'panorama');
    if (view === 'panorama') renderPanoramaView();
    else renderMonthlyView();
  };

  const openModal = (modal) => modal.classList.remove('hidden');
  const closeModal = (modal) => modal.classList.add('hidden');

  // --- Event Listeners ---
  loginBtn.addEventListener('click', () => {
    window.location.href = `${apiUrl}/auth/google`;
  });

  logoutBtn.addEventListener('click', () => {
    window.location.href = `${apiUrl}/auth/logout`;
  });

  document.getElementById('fab-main-btn').addEventListener('click', () => document.querySelector('.fab-actions').classList.toggle('hidden'));
  document.getElementById('open-account-modal-btn').addEventListener('click', () => {
    accountForm.reset();
    document.getElementById('account-modal-title').textContent = 'Adicionar Conta';
    accountForm.querySelector('button[type="submit"]').textContent = 'Salvar';
    accountForm.querySelector('#account-id').value = '';
    createCardSelector(document.getElementById('account-type-selector'), accountTypeOptions, accountForm.querySelector('#account-type'));
    openModal(accountModal);
  });
  document.getElementById('open-add-transaction-modal-btn').addEventListener('click', async () => {
    await populateAccountsDropdown(document.getElementById('transaction-account'));
    openModal(addTransactionModal);
  });
  document.getElementById('open-manage-recurring-modal-btn').addEventListener('click', async () => {
    await renderRecurringRules();
    openModal(manageRecurringModal);
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); });
    modal.querySelector('.cancel-btn')?.addEventListener('click', () => closeModal(modal));
  });

  document.querySelector('.view-switcher-container').addEventListener('click', (event) => {
    if (event.target.classList.contains('view-switch-btn')) switchView(event.target.dataset.view);
  });

  document.getElementById('date-navigation-container').addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('year-card')) selectedYear = parseInt(target.dataset.year);
    else if (target.classList.contains('month-tab')) selectedMonth = parseInt(target.dataset.month);
    else return;
    updateActiveDateButtons();
    renderMonthlyView();
  });

  panoramaView.addEventListener('click', (event) => {
    if (event.target.classList.contains('details-toggle-btn')) {
        const card = event.target.closest('.panorama-card');
        const detailsContainer = card.querySelector('.account-details-container');
        detailsContainer.classList.toggle('hidden');
        event.target.textContent = detailsContainer.classList.contains('hidden') ? 'Ver Detalhes' : 'Ocultar Detalhes';
    }
  });

  document.getElementById('recurring-rules-list').addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-rule-btn')) {
      const ruleId = event.target.dataset.id;
      if (confirm('Tem certeza que deseja apagar esta regra de recorrência?')) {
        try {
          await fetch(`${apiUrl}/recurring-transactions/${ruleId}`, { method: 'DELETE' });
          await renderRecurringRules();
          await renderMonthlyView();
        } catch (error) {
          alert('Erro ao deletar a regra.');
        }
      }
    }
  });

  accountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = accountForm.querySelector('#account-id').value;
    const name = accountForm.querySelector('#account-name').value;
    const type = accountForm.querySelector('#account-type').value;
    const url = id ? `${apiUrl}/accounts/${id}` : `${apiUrl}/accounts`;
    const method = id ? 'PUT' : 'POST';
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) });
      closeModal(accountModal);
      await initializeApp();
    } catch (error) { alert(error.message); }
  });

  addTransactionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const type = addTransactionForm.querySelector('#transaction-type').value;
      const payload = {
        accountId: addTransactionForm.querySelector('#transaction-account').value,
        description: addTransactionForm.querySelector('#transaction-description').value,
        date: addTransactionForm.querySelector('#transaction-date').value,
        transactionType: type,
        value: type === 'installment' ? document.getElementById('installment-value').value : document.getElementById('transaction-value').value,
        numberOfInstallments: type === 'installment' ? document.getElementById('number-of-installments').value : null,
        dayOfMonth: type === 'recurring' ? new Date(addTransactionForm.querySelector('#transaction-date').value).getDate() : null
      };
      const targetUrl = type === 'recurring' ? `${apiUrl}/recurring-transactions` : `${apiUrl}/transactions`;
      await fetch(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      closeModal(addTransactionModal);
      await initializeApp();
    } catch (error) { alert(error.message); }
  });

  accountsListDiv.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.classList.contains('add-transaction-to-account-btn')) {
        const accountId = button.dataset.accountId;
        await populateAccountsDropdown(document.getElementById('transaction-account'), accountId);
        openModal(addTransactionModal);
        return;
    }

    if (button.classList.contains('edit-account-btn')) {
      const { id, name, type } = button.dataset;
      accountForm.querySelector('#account-id').value = id;
      accountForm.querySelector('#account-name').value = name;
      document.getElementById('account-modal-title').textContent = `Editar Conta: ${name}`;
      accountForm.querySelector('button[type="submit"]').textContent = 'Atualizar';
      const typeSelector = accountForm.querySelector('#account-type-selector');
      createCardSelector(typeSelector, accountTypeOptions, accountForm.querySelector('#account-type'));
      typeSelector.querySelector(`[data-value="${type}"]`)?.classList.add('active');
      accountForm.querySelector('#account-type').value = type;
      openModal(accountModal);
    }
    
    if (button.classList.contains('delete-btn')) {
        const { id, type, purchaseId } = button.dataset;
        transactionToDelete = { id, type, purchaseId };

        if (type === 'single') {
            if (confirm('Tem certeza que deseja deletar esta transação?')) {
                await fetch(`${apiUrl}/transactions/${id}`, { method: 'DELETE' });
                await initializeApp();
            }
        } else {
            const deleteSingleBtn = document.getElementById('delete-single-btn');
            const deleteFutureBtn = document.getElementById('delete-future-btn');
            const deleteRuleBtn = document.getElementById('delete-rule-btn');

            if (type === 'installment') {
                deleteSingleBtn.style.display = 'block';
                deleteFutureBtn.style.display = 'block';
                deleteRuleBtn.style.display = 'none';
            } else if (type === 'recurring') {
                deleteSingleBtn.style.display = 'none';
                deleteFutureBtn.style.display = 'none';
                deleteRuleBtn.style.display = 'block';
            }
            openModal(deleteConfirmationModal);
        }
    }

    if (button.classList.contains('edit-transaction-btn')) {
      const transactionId = button.dataset.id;
      try {
        const transactionResponse = await fetch(`${apiUrl}/transactions/${transactionId}`);
        if (!transactionResponse.ok) throw new Error('Transação não encontrada.');
        const transaction = await transactionResponse.json();

        editTransactionForm.querySelector('#edit-transaction-id').value = transaction.id;
        editTransactionForm.querySelector('#edit-transaction-description').value = transaction.description;
        editTransactionForm.querySelector('#edit-transaction-date').value = new Date(transaction.date).toISOString().split('T')[0];

        await populateAccountsDropdown(editTransactionForm.querySelector('#edit-transaction-account'), transaction.accountId);
        
        const type = transaction.transactionType || 'single';
        const typeSelector = editTransactionForm.querySelector('#edit-transaction-type-selector');
        editTransactionForm.querySelector('#edit-transaction-type').value = type;
        typeSelector.querySelectorAll('.selector-card').forEach(card => card.classList.remove('active'));
        typeSelector.querySelector(`[data-value="${type}"]`)?.classList.add('active');

        renderDynamicTransactionFields(type, 'edit-');
        if (type === 'single' || type === 'recurring') {
          document.getElementById('edit-transaction-value').value = transaction.value;
        } else if (type === 'installment') {
          document.getElementById('edit-installment-value').value = transaction.value;
          document.getElementById('edit-number-of-installments').value = transaction.installmentDetails.total;
        }

        openModal(editTransactionModal);
      } catch (error) {
        alert(`Erro ao carregar dados da transação: ${error.message}`);
      }
    }
  });

  // --- Delete Confirmation Modal Listeners ---
  document.getElementById('delete-single-btn').addEventListener('click', async () => {
    await fetch(`${apiUrl}/transactions/${transactionToDelete.id}`, { method: 'DELETE' });
    closeModal(deleteConfirmationModal);
    await initializeApp();
  });

  document.getElementById('delete-future-btn').addEventListener('click', async () => {
    await fetch(`${apiUrl}/transactions/${transactionToDelete.id}?scope=future`, { method: 'DELETE' });
    closeModal(deleteConfirmationModal);
    await initializeApp();
  });

  document.getElementById('delete-rule-btn').addEventListener('click', async () => {
    const ruleId = Math.abs(transactionToDelete.id);
    await fetch(`${apiUrl}/recurring-transactions/${ruleId}`, { method: 'DELETE' });
    closeModal(deleteConfirmationModal);
    await initializeApp();
  });


  editTransactionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = editTransactionForm.querySelector('#edit-transaction-id').value;
    const type = editTransactionForm.querySelector('#edit-transaction-type').value;
    
    let value, numberOfInstallments = null;
    if (type === 'single' || type === 'recurring') {
        value = editTransactionForm.querySelector('#edit-transaction-value').value;
    } else if (type === 'installment') {
        value = editTransactionForm.querySelector('#edit-installment-value').value;
        numberOfInstallments = editTransactionForm.querySelector('#edit-number-of-installments').value;
    }

    const payload = {
      accountId: editTransactionForm.querySelector('#edit-transaction-account').value,
      description: editTransactionForm.querySelector('#edit-transaction-description').value,
      date: editTransactionForm.querySelector('#edit-transaction-date').value,
      transactionType: type,
      value: value,
      numberOfInstallments: numberOfInstallments,
    };

    try {
      await fetch(`${apiUrl}/transactions/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      closeModal(editTransactionModal);
      await initializeApp();
    } catch (error) { 
      alert(error.message); 
    }
  });

  const initializeApp = async () => {
    createCardSelector(document.getElementById('account-type-selector'), accountTypeOptions, accountForm.querySelector('#account-type'));

    const transactionTypeOptions = [
        { value: 'single', label: 'Única', icon: '➡️' },
        { value: 'installment', label: 'Parcelada', icon: '➗' },
        { value: 'recurring', label: 'Recorrente', icon: '🔄' }
    ];
    
    createCardSelector(
      document.getElementById('transaction-type-selector'), 
      transactionTypeOptions, 
      addTransactionForm.querySelector('#transaction-type'), 
      (type) => renderDynamicTransactionFields(type)
    );

    createCardSelector(
      document.getElementById('edit-transaction-type-selector'), 
      transactionTypeOptions, 
      editTransactionForm.querySelector('#edit-transaction-type'), 
      (type) => renderDynamicTransactionFields(type, 'edit-')
    );

    addTransactionForm.reset();
    document.getElementById('transaction-date').value = getTodayDateString();
    const transactionTypeInput = addTransactionForm.querySelector('#transaction-type');
    transactionTypeInput.value = 'single';
    addTransactionForm.querySelector('#transaction-type-selector .selector-card[data-value="single"]').classList.add('active');
    renderDynamicTransactionFields('single');
    
    accountForm.reset();

    await populateDateNavigation();
    await renderMonthlyView();
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/status`);
      const data = await response.json();
      if (data.loggedIn) {
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        document.body.classList.add('app-loaded');
        userNameSpan.textContent = data.user.displayName || 'Usuário'; 
        userProfileDiv.classList.remove('hidden');
        initializeApp();
      } else {
        loginView.classList.remove('hidden');
        appView.classList.add('hidden');
      }
    } catch (error) {
      loginView.classList.remove('hidden');
      appView.classList.add('hidden');
      console.error('Erro ao verificar status de autenticação', error);
    }
  };

  checkAuthStatus();
});