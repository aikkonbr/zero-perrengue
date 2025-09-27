const admin = require('firebase-admin');

let serviceAccount;

// Lógica para carregar a chave de serviço
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // No Render, o conteúdo do JSON está na variável de ambiente
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Erro ao fazer parse da chave de serviço do Firebase a partir da variável de ambiente:', e);
    process.exit(1);
  }
} else {
  // Localmente, carrega o arquivo da chave de serviço
  serviceAccount = require('./firebase-service-account.json');
}

// Inicializa o Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Exporta a instância do banco de dados Firestore
const db = admin.firestore();

module.exports = { db };
