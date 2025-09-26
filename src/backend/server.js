const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rotas da API
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const recurringTransactionRoutes = require('./routes/recurringTransactionRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const panoramaRoutes = require('./routes/panoramaRoutes');

// A ordem é importante. Rotas mais específicas primeiro.
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/panorama', panoramaRoutes);


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
