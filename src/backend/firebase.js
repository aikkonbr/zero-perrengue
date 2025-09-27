const admin = require('firebase-admin');

// Carrega o arquivo da chave de serviço que você baixou
const serviceAccount = require('./firebase-service-account.json');

// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Exporta a instância do banco de dados Firestore para ser usada em outros arquivos
const db = admin.firestore();

module.exports = { db };
