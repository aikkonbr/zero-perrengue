const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

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
const getUserRecurringRulesPath = (userId) => path.join(dataDir, `${userId}_recurringTransactions.json`);
const getUserAccountsPath = (userId) => path.join(dataDir, `${userId}_accounts.json`);

const readData = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    return fileData ? JSON.parse(fileData) : [];
  } catch (error) {
    return [];
  }
};

const writeRecurringTransactions = (userId, data) => {
  const userRecurringRulesPath = getUserRecurringRulesPath(userId);
  fs.writeFileSync(userRecurringRulesPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rota para LER todas as regras (agora com nome da conta)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const recurringRules = readData(getUserRecurringRulesPath(userId));
  const accounts = readData(getUserAccountsPath(userId));

  const recurringWithAccountNames = recurringRules.map(rule => {
    const account = accounts.find(acc => acc.id === rule.accountId);
    return {
      ...rule,
      accountName: account ? account.name : 'Conta não encontrada'
    };
  });

  res.json(recurringWithAccountNames);
});

// Rota para CRIAR uma nova regra
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { accountId, description, value, dayOfMonth, date: startDate } = req.body;

  if (!accountId || !description || !value || !dayOfMonth || !startDate) {
    return res.status(400).json({ message: 'Dados incompletos.' });
  }

  const recurring = readData(getUserRecurringRulesPath(userId));
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
  writeRecurringTransactions(userId, recurring);

  res.status(201).json(newRule);
});

// Rota para DELETAR uma regra
router.delete('/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  let rules = readData(getUserRecurringRulesPath(userId));
  const initialLength = rules.length;

  const rulesToKeep = rules.filter(rule => rule.id != parseInt(id));

  if (rulesToKeep.length === initialLength) {
    return res.status(404).json({ message: 'Regra de recorrência não encontrada.' });
  }

  writeRecurringTransactions(userId, rulesToKeep);
  res.status(200).json({ message: 'Regra de recorrência deletada com sucesso.' });
});

module.exports = router;
