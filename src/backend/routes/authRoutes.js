const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();

// Configuração da Estratégia do Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
    scope: ['profile', 'email'] // Pedimos o perfil e o email do usuário
  },
  (accessToken, refreshToken, profile, done) => {
    // Esta função é chamada quando o Google retorna com sucesso.
    // 'profile' contém os dados do usuário do Google.
    // Por enquanto, apenas retornamos o perfil.
    return done(null, profile);
  }
));

// Salva o usuário na sessão (apenas o ID é suficiente)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Recupera o usuário da sessão (usando o ID)
// Em uma aplicação real, aqui você buscaria o usuário no banco de dados.
passport.deserializeUser((id, done) => {
    // Por enquanto, estamos salvando o objeto de perfil completo na sessão.
    // Em um passo futuro, podemos otimizar isso.
    done(null, id); 
});


// --- ROTAS DE AUTENTICAÇÃO ---

// Rota para iniciar o processo de login com Google
// O frontend irá redirecionar o usuário para '/api/auth/google'
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Rota de callback que o Google chama após o login
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-error' }), // O que fazer se o login falhar
  (req, res) => {
    // Se chegou aqui, o login foi um sucesso!
    // O Passport já salvou o usuário na sessão (req.user).
    // Redireciona o usuário para a página principal do frontend.
    res.redirect('https://zero-perrengue-app.onrender.com');
  }
);

// Rota para verificar o status do login
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Rota para fazer logout
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('https://zero-perrengue-app.onrender.com');
});

module.exports = router;
