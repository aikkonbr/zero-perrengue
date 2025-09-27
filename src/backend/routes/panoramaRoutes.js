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

// Rota do panorama (agora 100% baseada no Firestore)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

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

    // --- 1. Calculate Opening Balance ---
    const panoramaStartDate = new Date();
    panoramaStartDate.setDate(1);
    panoramaStartDate.setHours(0, 0, 0, 0);

    const transactionDates = physicalTransactions.map(t => t.date.getTime());
    const ruleDates = recurringRules.map(r => r.startDate.getTime());
    const validDates = [...transactionDates, ...ruleDates].filter(t => !isNaN(t));

    let openingBalance = 0;
    if (validDates.length > 0) {
        const firstDate = new Date(Math.min.apply(null, validDates));
        let currentYear = firstDate.getFullYear();
        let currentMonth = firstDate.getMonth();

        while (currentYear < panoramaStartDate.getFullYear() || (currentYear === panoramaStartDate.getFullYear() && currentMonth < panoramaStartDate.getMonth())) {
            let monthlyIncome = 0;
            let monthlyExpense = 0;

            physicalTransactions.forEach(t => {
                if (t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth) {
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
                ruleStartDate.setHours(0,0,0,0);
                const loopDate = new Date(currentYear, currentMonth, 1);
                if (loopDate >= ruleStartDate) {
                    const recurringDate = new Date(currentYear, currentMonth, rule.dayOfMonth);
                    if (recurringDate.getMonth() === currentMonth) {
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
    }

    // --- 2. Process 12 Months for Panorama ---
    let panoramaData = [];
    let lastCumulativeBalance = openingBalance;

    for (let i = 0; i < 12; i++) {
      const date = new Date(panoramaStartDate.getFullYear(), panoramaStartDate.getMonth() + i, 1);
      const currentYear = date.getFullYear();
      const currentMonth = date.getMonth();

      const monthName = date.toLocaleString('pt-BR', { month: 'short' });
      const yearName = date.getFullYear().toString().slice(-2);

      let monthData = {
          month: `${monthName}/${yearName}`,
          totalProventos: 0,
          totalDespesas: 0,
          saldoMes: 0,
          saldoAcumulado: 0,
          accountDetails: []
      };

      accounts.forEach(account => {
        let accountMonthlyTotal = 0;

        physicalTransactions.forEach(t => {
          // CORREÇÃO: Comparar IDs como strings (usando ==)
          if (t.accountId == account.id && t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth) {
            accountMonthlyTotal += t.value;
          }
        });

        recurringRules.forEach(rule => {
          const ruleStartDate = new Date(rule.startDate);
          ruleStartDate.setDate(1);
          ruleStartDate.setHours(0,0,0,0);
          const loopDate = new Date(currentYear, currentMonth, 1);

          // CORREÇÃO: Comparar IDs como strings (usando ==)
          if (rule.accountId == account.id && loopDate >= ruleStartDate) {
              const recurringDate = new Date(currentYear, currentMonth, rule.dayOfMonth);
              if (recurringDate.getMonth() === currentMonth) {
                  accountMonthlyTotal += rule.value;
              }
          }
        });
        
        if(accountMonthlyTotal > 0) {
            monthData.accountDetails.push({
                accountName: account.name,
                accountType: account.type,
                total: accountMonthlyTotal
            });
        }

        if (account.type === 'PROVENTO') {
          monthData.totalProventos += accountMonthlyTotal;
        } else {
          monthData.totalDespesas += accountMonthlyTotal;
        }
      });

      monthData.saldoMes = monthData.totalProventos - monthData.totalDespesas;
      lastCumulativeBalance += monthData.saldoMes;
      monthData.saldoAcumulado = lastCumulativeBalance;

      panoramaData.push(monthData);
    }

    res.json(panoramaData);
  } catch (error) {
    console.error("Error fetching panorama data:", error);
    res.status(500).json({ message: "Erro ao buscar dados do panorama.", error: error.message });
  }
});

module.exports = router;
