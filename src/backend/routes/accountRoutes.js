const express = require('express');
const router = express.Router();
const { db } = require('../firebase'); // Importa a conexão com o Firestore

// Middleware para garantir que o usuário está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ message: 'Não autorizado' });
};

router.use(isAuthenticated);

// Rota para LER todas as contas do usuário logado
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const accountsSnapshot = await db.collection('accounts').where('userId', '==', userId).get();
    const accounts = [];
    accountsSnapshot.forEach(doc => {
      accounts.push({ id: doc.id, ...doc.data() });
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas.', error });
  }
});

// Rota para CRIAR uma nova conta
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Nome e tipo são obrigatórios.' });
    }
    const newAccount = { userId, name, type };
    const docRef = await db.collection('accounts').add(newAccount);
    res.status(201).json({ id: docRef.id, ...newAccount });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar conta.', error });
  }
});

// Rota para ATUALIZAR uma conta
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, type } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Nome e tipo são obrigatórios.' });
    }

    const accountRef = db.collection('accounts').doc(id);
    const doc = await accountRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return res.status(404).json({ message: 'Conta não encontrada ou não autorizada.' });
    }

    await accountRef.update({ name, type });
    res.json({ id, name, type, userId });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar conta.', error });
  }
});

// Rota para DELETAR uma conta
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const accountRef = db.collection('accounts').doc(id);
    const doc = await accountRef.get();

    if (!doc.exists || doc.data().userId !== userId) {
      return res.status(404).json({ message: 'Conta não encontrada ou não autorizada.' });
    }

    await accountRef.delete();
    res.status(200).json({ message: 'Conta deletada com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar conta.', error });
  }
});

module.exports = router;
