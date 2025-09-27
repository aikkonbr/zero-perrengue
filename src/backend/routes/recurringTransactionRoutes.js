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

// Rota para LER todas as regras de recorrência do usuário
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const rulesSnapshot = await db.collection('recurringRules').where('userId', '==', userId).get();
    const accountsSnapshot = await db.collection('accounts').where('userId', '==', userId).get();

    const accounts = {};
    accountsSnapshot.forEach(doc => {
      accounts[doc.id] = doc.data().name;
    });

    const recurringRules = [];
    rulesSnapshot.forEach(doc => {
      const rule = doc.data();
      recurringRules.push({
        id: doc.id,
        ...rule,
        startDate: rule.startDate.toDate(),
        accountName: accounts[rule.accountId] || 'Conta não encontrada'
      });
    });

    res.json(recurringRules);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar regras de recorrência.', error: error.message });
  }
});

// Rota para CRIAR uma nova regra de recorrência
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId, description, value, dayOfMonth, date: startDate } = req.body;

    if (!accountId || !description || !value || !dayOfMonth || !startDate) {
      return res.status(400).json({ message: 'Dados incompletos.' });
    }

    const newRule = {
      userId,
      accountId, // CORREÇÃO: Salvar como string
      description,
      value: parseFloat(value),
      dayOfMonth: parseInt(dayOfMonth),
      startDate: Timestamp.fromDate(new Date(startDate))
    };

    const docRef = await db.collection('recurringRules').add(newRule);
    res.status(201).json({ id: docRef.id, ...newRule });

  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar regra de recorrência.', error: error.message });
  }
});

// Rota para DELETAR uma regra de recorrência
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const ruleRef = db.collection('recurringRules').doc(id);
    const doc = await ruleRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return res.status(404).json({ message: 'Regra de recorrência não encontrada ou não autorizada.' });
    }

    await ruleRef.delete();
    res.status(200).json({ message: 'Regra de recorrência deletada com sucesso.' });

  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar regra de recorrência.', error: error.message });
  }
});

module.exports = router;
