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
const getUserAccountsPath = (userId) => path.join(dataDir, `${userId}_accounts.json`);
const getUserTransactionsPath = (userId) => path.join(dataDir, `${userId}_transactions.json`);
const getUserRecurringRulesPath = (userId) => path.join(dataDir, `${userId}_recurringTransactions.json`);

const readData = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

// Rota para calcular o saldo acumulado (agora específica do usuário)
router.get('/opening-balance', (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Mês e ano são obrigatórios.' });
  }

  try {
    const accounts = readData(getUserAccountsPath(userId));
    const physicalTransactions = readData(getUserTransactionsPath(userId)).map(t => ({ ...t, date: new Date(t.date) }));
    const recurringRules = readData(getUserRecurringRulesPath(userId)).map(r => ({ ...r, startDate: new Date(r.startDate) }));

    const transactionDates = physicalTransactions.map(t => t.date.getTime());
    const ruleDates = recurringRules.map(r => r.startDate.getTime());
    const validDates = [...transactionDates, ...ruleDates].filter(t => !isNaN(t));

    if (validDates.length === 0) {
      return res.json({ openingBalance: 0 });
    }

    const firstDate = new Date(Math.min.apply(null, validDates));
    let currentYear = firstDate.getFullYear();
    let currentMonth = firstDate.getMonth();

    const targetYear = parseInt(year);
    const targetMonth = parseInt(month) - 1;

    let openingBalance = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
      let monthlyIncome = 0;
      let monthlyExpense = 0;

      physicalTransactions.forEach(t => {
        if (t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth) {
          const account = accounts.find(a => a.id === t.accountId);
          if (account) {
            if (account.type === 'PROVENTO') monthlyIncome += t.value;
            else monthlyExpense += t.value;
          }
        }
      });

      recurringRules.forEach(rule => {
        const ruleStartDate = new Date(rule.startDate);
        ruleStartDate.setDate(1);
        ruleStartDate.setHours(0, 0, 0, 0);
        const loopDate = new Date(currentYear, currentMonth, 1);
        if (loopDate >= ruleStartDate) {
          const recurringDate = new Date(currentYear, currentMonth, rule.dayOfMonth);
          if (recurringDate.getMonth() === currentMonth) {
            const account = accounts.find(a => a.id === rule.accountId);
            if (account) {
              if (account.type === 'PROVENTO') monthlyIncome += rule.value;
              else monthlyExpense += rule.value;
            }
          }
        }
      });
      
      openingBalance += (monthlyIncome - monthlyExpense);

      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    res.json({ openingBalance });
  } catch (error) {
    console.error("Error calculating opening balance:", error);
    res.status(500).json({ message: "Erro interno ao calcular saldo anterior.", error: error.message });
  }
});

module.exports = router;
