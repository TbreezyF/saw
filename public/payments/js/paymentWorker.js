paypal.Button.render({
  env: 'sandbox',
  client: {
    sandbox: 'demo_sandbox_client_id'
  },
  style: {
    size: 'responsive',
    color: 'blue'
  },
  payment: function (data, actions) {
    return actions.payment.create({
      transactions: [{
        amount: {
          total: invoiceAmount,
          currency: 'CAD'
        }
      }]
    });
  },
  onAuthorize: function (data, actions) {
    return actions.payment.execute()
      .then(function () {
        window.alert('Thank you for your purchase!');
      });
  }
}, '#paypal-button');