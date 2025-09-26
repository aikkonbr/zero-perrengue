const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const accountsPath = path.join(__dirname, '..', 'data', 'accounts.json');
const transactionsPath = path.join(__dirname, '..', 'data', 'transactions.json');
const recurringRulesPath = path.join(__dirname, '..', 'data', 'recurringTransactions.json');

const readData = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

// Rota para calcular o saldo acumulado até o início de um mês específico
router.get('/opening-balance', (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Mês e ano são obrigatórios.' });
  }

  try {
    const accounts = readData(accountsPath);
    const physicalTransactions = readData(transactionsPath).map(t => ({ ...t, date: new Date(t.date) }));
    const recurringRules = readData(recurringRulesPath).map(r => ({ ...r, startDate: new Date(r.startDate) }));

    // 1. Encontrar o Ponto de Partida (a data mais antiga de todas as transações)
    const transactionDates = physicalTransactions.map(t => t.date.getTime());
    const ruleDates = recurringRules.map(r => r.startDate.getTime());
    const validDates = [...transactionDates, ...ruleDates].filter(t => !isNaN(t));

    if (validDates.length === 0) {
      return res.json({ openingBalance: 0 });
    }

    const firstDate = new Date(Math.min.apply(null, validDates));
    let currentYear = firstDate.getFullYear();
    let currentMonth = firstDate.getMonth(); // 0-11

    const targetYear = parseInt(year);
    const targetMonth = parseInt(month) - 1; // 0-11

    let openingBalance = 0;

    // 2. Iterar Mês a Mês, fazendo o "fechamento de caixa"
    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
      let monthlyIncome = 0;
      let monthlyExpense = 0;

      // 3a. Somar transações físicas do mês corrente do loop
      physicalTransactions.forEach(t => {
        if (t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth) {
          const account = accounts.find(a => a.id === t.accountId);
          if (account) {
            if (account.type === 'PROVENTO') {
              monthlyIncome += t.value;
            } else {
              monthlyExpense += t.value;
            }
          }
        }
      });

      // 3b. Gerar e somar transações recorrentes do mês corrente do loop
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
              if (account.type === 'PROVENTO') {
                monthlyIncome += rule.value;
              } else {
                monthlyExpense += rule.value;
              }
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
