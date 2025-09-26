const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'recurringTransactions.json');
const accountsPath = path.join(__dirname, '..', 'data', 'accounts.json');

const readData = (filePath) => {
  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    return fileData ? JSON.parse(fileData) : [];
  } catch (error) {
    return [];
  }
};

const writeRecurringTransactions = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rota para LER todas as regras de transações recorrentes (com nome da conta)
router.get('/', (req, res) => {
  const recurringRules = readData(dataPath);
  const accounts = readData(accountsPath);

  const recurringWithAccountNames = recurringRules.map(rule => {
    const account = accounts.find(acc => acc.id === rule.accountId);
    return {
      ...rule,
      accountName: account ? account.name : 'Conta não encontrada'
    };
  });

  res.json(recurringWithAccountNames);
});

// Rota para CRIAR uma nova regra de transação recorrente
router.post('/', (req, res) => {
  const { accountId, description, value, dayOfMonth, date: startDate } = req.body;

  if (!accountId || !description || !value || !dayOfMonth || !startDate) {
    return res.status(400).json({ message: 'Dados incompletos para criar regra recorrente.' });
  }

  const recurring = readData(dataPath);
  const nextId = recurring.length > 0 ? Math.max(...recurring.map(r => r.id)) + 1 : 1;

  const newRule = {
    id: nextId,
    accountId: parseInt(accountId),
    description,
    value: parseFloat(value),
    dayOfMonth: parseInt(dayOfMonth),
    startDate: new Date(startDate)
  };

  recurring.push(newRule);
  writeRecurringTransactions(recurring);

  res.status(201).json(newRule);
});

// Rota para DELETAR uma regra de transação recorrente
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  let rules = readData(dataPath);
  const initialLength = rules.length;

  const rulesToKeep = rules.filter(rule => rule.id != parseInt(id));

  if (rulesToKeep.length === initialLength) {
    return res.status(404).json({ message: 'Regra de recorrência não encontrada.' });
  }

  writeRecurringTransactions(rulesToKeep);
  res.status(200).json({ message: 'Regra de recorrência deletada com sucesso.' });
});

module.exports = router;
