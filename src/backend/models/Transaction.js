class Transaction {
  constructor(id, accountId, description, value, date, installmentDetails, purchaseId = null) {
    this.id = id;
    this.accountId = accountId;
    this.description = description;
    this.value = value;
    this.date = date;
    this.installmentDetails = installmentDetails; // Ex: { current: 3, total: 12 }
    this.purchaseId = purchaseId; // ID único que agrupa todas as parcelas de uma compra
  }
}

module.exports = Transaction;
