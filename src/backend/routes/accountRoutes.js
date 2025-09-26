const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Account = require('../models/Account');

const dataPath = path.join(__dirname, '..', 'data', 'accounts.json');

const readAccounts = () => {
  try {
    const fileData = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    return [];
  }
};

const writeAccounts = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
};

// Rota para buscar todas as contas
router.get('/', (req, res) => {
  const accounts = readAccounts();
  res.json(accounts);
});

// Rota para criar uma nova conta
router.post('/', (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Nome e tipo da conta são obrigatórios.' });
  }

  const accounts = readAccounts();
  const nextId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;

  const newAccount = new Account(nextId, name, type);
  accounts.push(newAccount);
  
  writeAccounts(accounts);
  
  res.status(201).json(newAccount);
});

// Rota para ATUALIZAR uma conta
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Nome e tipo da conta são obrigatórios.' });
  }

  const accounts = readAccounts();
  const accountIndex = accounts.findIndex(a => a.id == parseInt(id));

  if (accountIndex === -1) {
    return res.status(404).json({ message: 'Conta não encontrada.' });
  }

  // Atualiza os dados da conta
  accounts[accountIndex].name = name;
  accounts[accountIndex].type = type;

  writeAccounts(accounts);

  res.status(200).json(accounts[accountIndex]);
});

module.exports = router;
