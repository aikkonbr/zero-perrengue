const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Paths to data files
const accountsPath = path.join(__dirname, '..', 'data', 'accounts.json');
const transactionsPath = path.join(__dirname, '..', 'data', 'transactions.json');
const recurringRulesPath = path.join(__dirname, '..', 'data', 'recurringTransactions.json');

// Helper to read data files
const readData = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

// Main route for panorama data - REBUILT FOR CARDS
router.get('/', (req, res) => {
  const accounts = readData(accountsPath);
  const physicalTransactions = readData(transactionsPath).map(t => ({ ...t, date: new Date(t.date) }));
  const recurringRules = readData(recurringRulesPath).map(r => ({ ...r, startDate: new Date(r.startDate) }));

  // --- 1. Calculate Opening Balance for the Panorama Start Date ---
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
              ruleStartDate.setHours(0,0,0,0);
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
  }

  // --- 2. Process 12 Months for Panorama, grouped by month ---
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

    // Aggregate transactions for each account
    accounts.forEach(account => {
      let accountMonthlyTotal = 0;

      physicalTransactions.forEach(t => {
        if (t.accountId === account.id && t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth) {
          accountMonthlyTotal += t.value;
        }
      });

      recurringRules.forEach(rule => {
        const ruleStartDate = new Date(rule.startDate);
        ruleStartDate.setDate(1);
        ruleStartDate.setHours(0,0,0,0);
        const loopDate = new Date(currentYear, currentMonth, 1);

        if (rule.accountId === account.id && loopDate >= ruleStartDate) {
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
});

module.exports = router;
