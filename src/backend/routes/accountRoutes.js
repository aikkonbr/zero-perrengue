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

// Funções de dados agora usam o ID do usuário para encontrar o arquivo certo
const getUserAccountsPath = (userId) => path.join(dataDir, `${userId}_accounts.json`);

const readAccounts = (userId) => {
  const userAccountsPath = getUserAccountsPath(userId);
  if (!fs.existsSync(userAccountsPath)) {
    return []; // Se o arquivo não existe, retorna um array vazio
  }
  try {
    const fileData = fs.readFileSync(userAccountsPath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    return [];
  }
};

const writeAccounts = (userId, data) => {
  const userAccountsPath = getUserAccountsPath(userId);
  fs.writeFileSync(userAccountsPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rotas agora usam req.user.id para operar nos dados do usuário logado
router.get('/', (req, res) => {
  const accounts = readAccounts(req.user.id);
  res.json(accounts);
});

router.post('/', (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Nome e tipo são obrigatórios.' });
  }
  const accounts = readAccounts(req.user.id);
  const newAccount = {
    id: accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1,
    name,
    type
  };
  accounts.push(newAccount);
  writeAccounts(req.user.id, accounts);
  res.status(201).json(newAccount);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Nome e tipo são obrigatórios.' });
  }
  let accounts = readAccounts(req.user.id);
  const accountIndex = accounts.findIndex(acc => acc.id == id);
  if (accountIndex === -1) {
    return res.status(404).json({ message: 'Conta não encontrada.' });
  }
  accounts[accountIndex] = { ...accounts[accountIndex], name, type };
  writeAccounts(req.user.id, accounts);
  res.json(accounts[accountIndex]);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  let accounts = readAccounts(req.user.id);
  const initialLength = accounts.length;
  accounts = accounts.filter(acc => acc.id != id);
  if (accounts.length === initialLength) {
    return res.status(404).json({ message: 'Conta não encontrada.' });
  }
  writeAccounts(req.user.id, accounts);
  res.status(200).json({ message: 'Conta deletada com sucesso.' });
});

module.exports = router;
