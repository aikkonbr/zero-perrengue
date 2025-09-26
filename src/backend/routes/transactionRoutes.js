const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Transaction = require('../models/Transaction');

// Paths to data files
const transactionsPath = path.join(__dirname, '..', 'data', 'transactions.json');
const recurringRulesPath = path.join(__dirname, '..', 'data', 'recurringTransactions.json');

// Helper functions to read data
const readData = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
};

const writeTransactions = (data) => {
  fs.writeFileSync(transactionsPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rota para buscar transações com geração dinâmica de recorrentes
router.get('/', (req, res) => {
  const physicalTransactions = readData(transactionsPath).map(t => ({ 
    ...t, 
    date: new Date(t.date),
    transactionType: t.installmentDetails ? 'installment' : 'single' 
  }));
  const recurringRules = readData(recurringRulesPath);
  
  const { accountId, month, year } = req.query;
  let combinedTransactions = [...physicalTransactions];

  if (month && year) {
    const targetMonth = parseInt(month) - 1; // JS months are 0-11
    const targetYear = parseInt(year);
    const targetDate = new Date(targetYear, targetMonth, 1); // Primeiro dia do mês alvo

    recurringRules.forEach(rule => {
      const ruleStartDate = new Date(rule.startDate);
      ruleStartDate.setDate(1);
      ruleStartDate.setHours(0, 0, 0, 0);
      
      if (targetDate >= ruleStartDate) {
        const recurringDate = new Date(targetYear, targetMonth, rule.dayOfMonth);
        if (recurringDate.getMonth() === targetMonth && recurringDate.getFullYear() === targetYear) {
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

  let filteredTransactions = combinedTransactions;
  if (month && year) {
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return (transactionDate.getMonth() + 1) === targetMonth && transactionDate.getFullYear() === targetYear;
    });
  }

  if (accountId) {
    filteredTransactions = filteredTransactions.filter(t => t.accountId == parseInt(accountId));
  }

  res.json(filteredTransactions);
});

// Rota para buscar uma transação específica por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  if (id <= 0) {
    return res.status(404).json({ message: 'Transação não encontrada.' });
  }
  const transactions = readData(transactionsPath);
  const transaction = transactions.find(t => t.id == parseInt(id));
  
  if (transaction) {
    const transactionWithType = {
      ...transaction,
      transactionType: transaction.installmentDetails ? 'installment' : 'single'
    };
    res.json(transactionWithType);
  } else {
    res.status(404).json({ message: 'Transação não encontrada.' });
  }
});

// Rota para criar transações
router.post('/', (req, res) => {
  const { accountId, description, date, transactionType, value, numberOfInstallments } = req.body;

  if (!accountId || !description || !date || !value || !transactionType) {
    return res.status(400).json({ message: 'Dados incompletos para criar transação.' });
  }

  const transactions = readData(transactionsPath);
  let nextId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
  const initialDate = new Date(date);

  if (transactionType === 'installment') {
    if (!numberOfInstallments || numberOfInstallments < 1) {
      return res.status(400).json({ message: 'Número de parcelas inválido.' });
    }
    const purchaseId = Date.now(); // Gera um ID único para a compra
    for (let i = 0; i < numberOfInstallments; i++) {
      const installmentDate = new Date(initialDate);
      installmentDate.setMonth(initialDate.getMonth() + i);
      const installmentDescription = `${description} (${i + 1}/${numberOfInstallments})`;
      const newTransaction = new Transaction(nextId++, parseInt(accountId), installmentDescription, parseFloat(value), installmentDate, { current: i + 1, total: parseInt(numberOfInstallments) }, purchaseId);
      transactions.push(newTransaction);
    }
  } else { // Transação Única
    const newTransaction = new Transaction(nextId, parseInt(accountId), description, parseFloat(value), initialDate, null, null);
    transactions.push(newTransaction);
  }
  
  writeTransactions(transactions);
  res.status(201).json({ message: 'Transação(ões) criada(s) com sucesso.' });
});

// Rota para ATUALIZAR uma transação
router.put('/:id', (req, res) => {
  const { id } = req.params;
  if (id <= 0) {
    return res.status(400).json({ message: 'Não é possível editar uma transação recorrente.' });
  }

  const { accountId, description, value, date } = req.body;

  if (!accountId || description === undefined || value === undefined || !date) {
    return res.status(400).json({ message: 'Conta, descrição, valor e data são obrigatórios.' });
  }

  const transactions = readData(transactionsPath);
  const transactionIndex = transactions.findIndex(t => t.id == parseInt(id));

  if (transactionIndex === -1) {
    return res.status(404).json({ message: 'Transação não encontrada.' });
  }

  const originalTransaction = transactions[transactionIndex];
  
  originalTransaction.accountId = parseInt(accountId);
  originalTransaction.description = description;
  originalTransaction.value = parseFloat(value);
  originalTransaction.date = new Date(date);

  writeTransactions(transactions);
  res.status(200).json(originalTransaction);
});

// Rota para DELETAR transações com escopo
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const { scope } = req.query; // 'single' or 'future'

  let transactions = readData(transactionsPath);
  const transactionToDelete = transactions.find(t => t.id == parseInt(id));

  if (!transactionToDelete) {
    return res.status(404).json({ message: 'Transação não encontrada.' });
  }

  let transactionsToKeep;

  if (scope === 'future') {
    if (!transactionToDelete.purchaseId) {
      return res.status(400).json({ message: 'Esta transação não é uma parcela e não pode ser excluída em escopo futuro.' });
    }
    const purchaseId = transactionToDelete.purchaseId;
    const deletionStartDate = new Date(transactionToDelete.date);

    transactionsToKeep = transactions.filter(t => {
      return t.purchaseId !== purchaseId || new Date(t.date) < deletionStartDate;
    });
  } else {
    // Escopo padrão: deleta apenas a transação única
    transactionsToKeep = transactions.filter(t => t.id != parseInt(id));
  }

  if (transactionsToKeep.length === transactions.length && transactions.length > 0) {
     return res.status(404).json({ message: 'Nenhuma transação para deletar com os critérios informados.' });
  }

  writeTransactions(transactionsToKeep);
  res.status(200).json({ message: 'Transação(ões) deletada(s) com sucesso.' });
});

module.exports = router;
