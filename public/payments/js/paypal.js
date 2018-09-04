paypal.Button.render({
    env: 'production', // Or 'production'
    // Set up the payment:
    // 1. Add a payment callback

    style: {
      color: 'blue',
      size: 'responsive'
    },

    payment: function(data, actions) {
      // 2. Make a request to your server
      return actions.request.post('/payments/paypal/?auth=paypal&amount=' + invoiceAmount)
        .then(function(res) {
          // 3. Return res.id from the response
          return res.id;
        });
    },
    // Execute the payment:
    // 1. Add an onAuthorize callback
    onAuthorize: function(data, actions) {
      // 2. Make a request to your server
      return actions.request.post('/payments/paypal/execute/?auth=paypal&amount=' + invoiceAmount + '&id=' + clientNumber + '&invoiceNumber=' + invoiceNumber, {
        paymentID: data.paymentID,
        payerID:   data.payerID
      })
        .then(function(res) {
          // 3. Show the buyer a confirmation message.
          if(res.status === 'success'){
            $('#nav-tab-paypal').addClass('d-none');
            $('#payment-spinner').addClass('d-none');
            $('#nav-tab-card').addClass('d-none');
            $('#error-card').addClass('d-none');
            $('#show-thanks-server').removeClass('d-none'); 
            $('#change-info-warning').removeClass('d-none');
            $('#payment-methods').addClass('d-none'); 
          }
          else if(res.error === true){
            $('#error-paypal').removeClass('d-none');
            return actions.restart();
          }
          else{
            $('#error-paypal').removeClass('d-none');
            $('#error-paypal').html('Payment could not be processed through Paypal. Try another method.');
          }
        });
    },

    onError: function(err){
      $('#error-paypal').removeClass('d-none');
      $('#error-paypal').html('Payment could not be processed through Paypal. Try another method.');
    }
  }, '#paypal-button');