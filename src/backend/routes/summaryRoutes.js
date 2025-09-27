const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// Middleware de autenticação
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ message: 'Não autorizado' });
};
router.use(isAuthenticated);

// Rota para calcular o saldo de abertura (opening balance)
router.get('/opening-balance', async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Mês e ano são obrigatórios.' });
    }

    // Busca todos os dados do usuário em paralelo
    const [accountsSnapshot, transactionsSnapshot, rulesSnapshot] = await Promise.all([
      db.collection('accounts').where('userId', '==', userId).get(),
      db.collection('transactions').where('userId', '==', userId).get(),
      db.collection('recurringRules').where('userId', '==', userId).get()
    ]);

    const accounts = [];
    accountsSnapshot.forEach(doc => accounts.push({ id: doc.id, ...doc.data() }));

    const physicalTransactions = [];
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      physicalTransactions.push({ ...data, date: data.date.toDate() });
    });

    const recurringRules = [];
    rulesSnapshot.forEach(doc => {
      const data = doc.data();
      recurringRules.push({ ...data, startDate: data.startDate.toDate() });
    });

    // Lógica de cálculo do saldo de abertura
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
          // CORREÇÃO: Comparar IDs como strings (usando ==)
          const account = accounts.find(a => a.id == t.accountId);
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
            // CORREÇÃO: Comparar IDs como strings (usando ==)
            const account = accounts.find(a => a.id == rule.accountId);
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
