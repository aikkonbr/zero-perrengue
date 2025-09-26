require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const app = express();
const port = 3000;

app.set('trust proxy', 1);

// Configuração do CORS para permitir credenciais de um subdomínio diferente
app.use(cors({
  origin: 'https://zero-perrengue-app.onrender.com', // Permite requisições do seu frontend
  credentials: true // Permite o envio de cookies
}));

app.use(express.json());

// Configuração da Sessão para funcionar entre subdomínios
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // Não cria sessão até que algo seja armazenado
  cookie: {
    secure: true, // Garante que o cookie só seja enviado via HTTPS
    httpOnly: true, // Previne acesso via JavaScript no frontend
    sameSite: 'none', // Essencial para permitir o cookie em um contexto cross-site
    domain: '.onrender.com' // O cookie será válido para todos os subdomínios de onrender.com
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

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/panorama', panoramaRoutes);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
