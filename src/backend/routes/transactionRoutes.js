const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Transaction = require('../models/Transaction');

const dataDir = path.join(__dirname, '..', 'data');

// Middleware para garantir que o usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Não autorizado' });
};

// Aplica o middleware a todas as rotas deste arquivo
router.use(isAuthenticated);

// Funções de dados agora usam o ID do usuário
const getUserTransactionsPath = (userId) => path.join(dataDir, `${userId}_transactions.json`);
const getUserRecurringRulesPath = (userId) => path.join(dataDir, `${userId}_recurringTransactions.json`);

const readData = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    return [];
  }
};

const writeTransactions = (userId, data) => {
  const userTransactionsPath = getUserTransactionsPath(userId);
  fs.writeFileSync(userTransactionsPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rota para buscar transações (agora específica do usuário)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const physicalTransactions = readData(getUserTransactionsPath(userId)).map(t => ({ ...t, date: new Date(t.date), transactionType: t.installmentDetails ? 'installment' : 'single' }));
  const recurringRules = readData(getUserRecurringRulesPath(userId));
  
  const { accountId, month, year } = req.query;
  let combinedTransactions = [...physicalTransactions];

  if (month && year) {
    const targetMonth = parseInt(month) - 1;
    const targetYear = parseInt(year);
    const targetDate = new Date(targetYear, targetMonth, 1);

    recurringRules.forEach(rule => {
      const ruleStartDate = new Date(rule.startDate);
      ruleStartDate.setDate(1);
      ruleStartDate.setHours(0, 0, 0, 0);
      
      if (targetDate >= ruleStartDate) {
        const recurringDate = new Date(targetYear, targetMonth, rule.dayOfMonth);
        if (recurringDate.getMonth() === targetMonth) {
          combinedTransactions.push({
            id: -rule.id, 
            accountId: rule.accountId,
            description: rule.description,
            value: rule.value,
            date: recurringDate,
            isRecurring: true,
            transactionType: 'recurring'
          });
        }
      }
    });
  }

  let filteredTransactions = combinedTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getFullYear() == year && (transactionDate.getMonth() + 1) == month;
  });

  if (accountId) {
    filteredTransactions = filteredTransactions.filter(t => t.accountId == parseInt(accountId));
  }

  res.json(filteredTransactions);
});

// Rota para buscar uma transação específica por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const transactions = readData(getUserTransactionsPath(req.user.id));
  const transaction = transactions.find(t => t.id == parseInt(id));
  
  if (transaction) {
    res.json({ ...transaction, transactionType: transaction.installmentDetails ? 'installment' : 'single' });
  } else {
    res.status(404).json({ message: 'Transação não encontrada.' });
  }
});

// Rota para criar transações
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { accountId, description, date, transactionType, value, numberOfInstallments } = req.body;

  if (!accountId || !description || !date || !value || !transactionType) {
    return res.status(400).json({ message: 'Dados incompletos.' });
  }

  const transactions = readData(getUserTransactionsPath(userId));
  let nextId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
  const initialDate = new Date(date);

  if (transactionType === 'installment') {
    if (!numberOfInstallments || numberOfInstallments < 1) {
      return res.status(400).json({ message: 'Número de parcelas inválido.' });
    }
    const purchaseId = Date.now();
    for (let i = 0; i < numberOfInstallments; i++) {
      const installmentDate = new Date(initialDate);
      installmentDate.setMonth(initialDate.getMonth() + i);
      const installmentDescription = `${description} (${i + 1}/${numberOfInstallments})`;
      const newTransaction = new Transaction(nextId++, parseInt(accountId), installmentDescription, parseFloat(value), installmentDate, { current: i + 1, total: parseInt(numberOfInstallments) }, purchaseId);
      transactions.push(newTransaction);
    }
  } else {
    const newTransaction = new Transaction(nextId, parseInt(accountId), description, parseFloat(value), initialDate, null, null);
    transactions.push(newTransaction);
  }
  
  writeTransactions(userId, transactions);
  res.status(201).json({ message: 'Transação(ões) criada(s) com sucesso.' });
});

// Rota para ATUALIZAR uma transação
router.put('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { accountId, description, value, date } = req.body;

  if (!accountId || description === undefined || value === undefined || !date) {
    return res.status(400).json({ message: 'Dados obrigatórios faltando.' });
  }

  const transactions = readData(getUserTransactionsPath(userId));
  const transactionIndex = transactions.findIndex(t => t.id == parseInt(id));

  if (transactionIndex === -1) {
    return res.status(404).json({ message: 'Transação não encontrada.' });
  }

  transactions[transactionIndex] = { ...transactions[transactionIndex], accountId: parseInt(accountId), description, value: parseFloat(value), date: new Date(date) };
  writeTransactions(userId, transactions);
  res.json(transactions[transactionIndex]);
});

// Rota para DELETAR transações com escopo
router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { scope } = req.query;

  let transactions = readData(getUserTransactionsPath(userId));
  const transactionToDelete = transactions.find(t => t.id == parseInt(id));

  if (!transactionToDelete) {
    return res.status(404).json({ message: 'Transação não encontrada.' });
  }

  let transactionsToKeep;

  if (scope === 'future' && transactionToDelete.purchaseId) {
    const purchaseId = transactionToDelete.purchaseId;
    const deletionStartDate = new Date(transactionToDelete.date);
    transactionsToKeep = transactions.filter(t => t.purchaseId !== purchaseId || new Date(t.date) < deletionStartDate);
  } else {
    transactionsToKeep = transactions.filter(t => t.id != parseInt(id));
  }

  if (transactionsToKeep.length === transactions.length) {
     return res.status(404).json({ message: 'Nenhuma transação para deletar.' });
  }

  writeTransactions(userId, transactionsToKeep);
  res.status(200).json({ message: 'Transação(ões) deletada(s) com sucesso.' });
});

module.exports = router;
