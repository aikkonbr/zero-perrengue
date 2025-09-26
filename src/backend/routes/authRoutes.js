const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();

// Configuração da Estratégia do Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // CORREÇÃO DEFINITIVA: Usando um caminho relativo. O Passport irá construir a URL completa dinamicamente.
    callbackURL: '/api/auth/google/callback',
    scope: ['profile', 'email']
  },
  (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value,
      photo: profile.photos[0].value
    };
    return done(null, user);
  }
));

// Salva o usuário na sessão
passport.serializeUser((user, done) => {
  done(null, user);
});

// Recupera o usuário da sessão
passport.deserializeUser((user, done) => {
  done(null, user);
});


// --- ROTAS DE AUTENTICAÇÃO ---

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { 
    successRedirect: 'https://zero-perrengue-app.onrender.com',
    failureRedirect: 'https://zero-perrengue-app.onrender.com' // Em caso de falha, volta para a tela de login
  })
);

router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false });
  }
});

router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('https://zero-perrengue-app.onrender.com');
  });
});

module.exports = router;
