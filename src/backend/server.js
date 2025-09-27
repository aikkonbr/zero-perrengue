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
// CORREÇÃO: Configuração do CORS para permitir credenciais do frontend
app.use(cors({
  origin: 'https://zero-perrengue-app.onrender.com', // URL do seu frontend
  credentials: true
}));
app.use(express.json());

// Configuração da Sessão para produção
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // Não cria sessão até que algo seja armazenado
  cookie: {
    secure: true, // O cookie só trafega em HTTPS
    httpOnly: true, // Previne acesso via JavaScript no frontend
    sameSite: 'none' // Permite que o cookie seja enviado em requisições de outro domínio
  }
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
