const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { Timestamp } = require('firebase-admin/firestore');

// Middleware de autenticação
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ message: 'Não autorizado' });
};
router.use(isAuthenticated);

// Rota para LER transações
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId, month, year } = req.query;

    // CASO 1: A requisição é para um mês específico (visão mensal)
    if (month && year) {
      const targetMonth = parseInt(month) - 1;
      const targetYear = parseInt(year);
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 1);

      const transactionsSnapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .where('date', '>=', Timestamp.fromDate(startDate))
        .where('date', '<', Timestamp.fromDate(endDate))
        .get();
      
      const physicalTransactions = [];
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        physicalTransactions.push({ 
          id: doc.id, 
          ...data,
          date: data.date.toDate(),
          transactionType: data.installmentDetails ? 'installment' : 'single'
        });
      });

      const recurringRulesSnapshot = await db.collection('recurringRules').where('userId', '==', userId).get();
      const virtualTransactions = [];
      recurringRulesSnapshot.forEach(doc => {
        const rule = doc.data();
        const ruleStartDate = rule.startDate.toDate();
        ruleStartDate.setDate(1);
        ruleStartDate.setHours(0, 0, 0, 0);

        if (startDate >= ruleStartDate) {
          const recurringDate = new Date(targetYear, targetMonth, rule.dayOfMonth);
          if (recurringDate.getMonth() === targetMonth) {
            virtualTransactions.push({
              id: `recurring_${doc.id}`,
              ...rule,
              date: recurringDate,
              isRecurring: true,
              transactionType: 'recurring'
            });
          }
        }
      });

      let combinedTransactions = [...physicalTransactions, ...virtualTransactions];

      if (accountId) {
        combinedTransactions = combinedTransactions.filter(t => t.accountId == accountId);
      }
      // CORREÇÃO: Mover o res.json para fora do if do accountId
      return res.json(combinedTransactions);

    } 
    // CASO 2: A requisição é para TODAS as transações (para popular a navegação de anos)
    else {
      const transactionsSnapshot = await db.collection('transactions').where('userId', '==', userId).get();
      const allTransactions = [];
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        allTransactions.push({ id: doc.id, ...data, date: data.date.toDate() });
      });
      return res.json(allTransactions);
    }

  } catch (error) {
    // Se houver um erro de índice do Firestore, ele será capturado aqui.
    console.error("Erro ao buscar transações:", error);
    // A mensagem de erro do Firestore geralmente contém o link para criar o índice.
    if (error.message && error.message.includes('requires an index')) {
        return res.status(500).json({ 
            message: 'O banco de dados precisa de um índice para esta consulta. Verifique os logs do servidor para o link de criação.',
            error: error.message
        });
    }
    res.status(500).json({ message: 'Erro interno ao buscar transações.', error: error.message });
  }
});

// As outras rotas (POST, DELETE, etc.) permanecem as mesmas...

// Rota para CRIAR transações (única ou parcelada)
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId, description, date, transactionType, value, numberOfInstallments } = req.body;

    if (!accountId || !description || !date || !value || !transactionType) {
      return res.status(400).json({ message: 'Dados incompletos.' });
    }

    const batch = db.batch();
    const initialDate = new Date(date);

    if (transactionType === 'installment' && numberOfInstallments > 1) {
      const purchaseId = Date.now().toString();
      for (let i = 0; i < numberOfInstallments; i++) {
        const installmentDate = new Date(initialDate);
        installmentDate.setMonth(initialDate.getMonth() + i);
        
        const newTransaction = {
          userId,
          accountId,
          description: `${description} (${i + 1}/${numberOfInstallments})`,
          value: parseFloat(value),
          date: Timestamp.fromDate(installmentDate),
          installmentDetails: { current: i + 1, total: parseInt(numberOfInstallments) },
          purchaseId
        };
        const docRef = db.collection('transactions').doc();
        batch.set(docRef, newTransaction);
      }
    } else {
      const newTransaction = {
        userId,
        accountId,
        description,
        value: parseFloat(value),
        date: Timestamp.fromDate(initialDate),
        installmentDetails: null,
        purchaseId: null
      };
      const docRef = db.collection('transactions').doc();
      batch.set(docRef, newTransaction);
    }

    await batch.commit();
    res.status(201).json({ message: 'Transação(ões) criada(s) com sucesso.' });

  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar transação.', error: error.message });
  }
});

// Rota para DELETAR transações
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { scope } = req.query;

    const transactionRef = db.collection('transactions').doc(id);
    const doc = await transactionRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return res.status(404).json({ message: 'Transação não encontrada ou não autorizada.' });
    }

    if (scope === 'future' && doc.data().purchaseId) {
      const purchaseId = doc.data().purchaseId;
      const deletionStartDate = doc.data().date.toDate();

      const batch = db.batch();
      const snapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .where('purchaseId', '==', purchaseId)
        .where('date', '>=', Timestamp.fromDate(deletionStartDate))
        .get();

      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

    } else {
      await transactionRef.delete();
    }

    res.status(200).json({ message: 'Transação(ões) deletada(s) com sucesso.' });

  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar transação.', error: error.message });
  }
});

module.exports = router;
