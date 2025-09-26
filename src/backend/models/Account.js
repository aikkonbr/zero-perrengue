class Account {
  constructor(id, name, type) {
    this.id = id;
    this.name = name; // Ex: "ITAU BLACK", "NU BANK"
    this.type = type; // Ex: "CARTAO_DE_CREDITO", "DIVIDA_FIXA", "PROVENTO"
  }
}

module.exports = Account;
