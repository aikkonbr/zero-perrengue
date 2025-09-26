require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const app = express();
const port = 3000;

// Confie no proxy do Render para determinar o protocolo (http vs https)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Configuração da Sessão
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Em produção, o cookie só trafega em HTTPS
}));

// Inicialização do Passport
app.use(passport.initialize());
app.use(passport.session());

// Rotas da API
const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const recurringTransactionRoutes = require('./routes/recurringTransactionRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const panoramaRoutes = require('./routes/panoramaRoutes');

// A ordem é importante
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/panorama', panoramaRoutes);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
