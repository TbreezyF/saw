var invoiceNumber, clientNumber, invoiceAmount;
$(document).ready(function(){

    $('#nav-tab-paypal-link').click(function(){
      $('#show-thanks-server').addClass('d-none');
      $('#nav-tab-card').removeClass('show active');
      $('#nav-tab-bank').removeClass('show active');
      $('#nav-tab-paypal').addClass('show active');

      $('#nav-tab-paypal-link').addClass('active');
      $('#nav-tab-card-link').removeClass('active');
      $('#nav-tab-bank-link').removeClass('active');
    });
    $('#nav-tab-card-link').click(function(){
      $('#show-thanks-server').addClass('d-none');
      $('#nav-tab-paypal').removeClass('show active');
      $('#nav-tab-bank').removeClass('show active');
      $('#nav-tab-card').addClass('show active');

      
      $('#nav-tab-paypal-link').removeClass('active');
      $('#nav-tab-card-link').addClass('active');
      $('#nav-tab-bank-link').removeClass('active');
    });
    $('#nav-tab-bank-link').click(function(){
      $('#show-thanks-server').addClass('d-none');
      $('#nav-tab-card').removeClass('show active');
      $('#nav-tab-paypal').removeClass('show active');
      $('#nav-tab-bank').addClass('show active');

      
      $('#nav-tab-paypal-link').removeClass('active');
      $('#nav-tab-card-link').removeClass('active');
      $('#nav-tab-bank-link').addClass('active');
    });
      //Validation
      //Handle Client Info Submittion
      $('#client-form').submit(function(e) {
        e.preventDefault();
        var client_email = $('#email').val();
        var client_number = $('#clientNumber').val();
        var invoice_number = $('#invoiceNumber').val();
        var amount = $('#invoiceAmount').val();
       // var payment_amount = $('#paymentAmount').val();
        var errors = 0;

        if (invoice_number.length < 2) {
          errors++;
          $('#error-client').removeClass('d-none');
          $('#error-client').html('Invoice number field is required and must be at least 2 digits');
        }
        if (amount.length < 3 || !Number(amount) || amount<500) {
          errors++;
          $('#error-client').removeClass('d-none');
          $('#error-client').html('Amount field is required and must be at least $500 CAD');
        }
        if (client_number.length < 2) {
          errors++;
          $('#error-client').removeClass('d-none');
          $('#error-client').html('Client Number field is required and must be at least 2 digits');
        }
        else if(!Number(client_number)){
          errors++;
          $('#error-client').removeClass('d-none');
          $('#error-client').html('The client number field must be a number');
        }
        if (client_email.length < 1) {
          errors++;
          $('#error-client').removeClass('d-none');
          $('#error-client').html('The email field is required');
        } else {
          var regEx =  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
          var validEmail = regEx.test(client_email);
          if (!validEmail) {
            errors++;
            $('#error-client').removeClass('d-none');
            $('#error-client').html('Please enter a valid email');
          }
        }

        if(errors == 0){

          $.post('/payments/clients', {
            email: client_email, 
            number: client_number, 
            invoice: invoice_number,
            amount: amount
          }).done(function(data){
            if(data.verified){
              invoiceNumber = data.invoiceNumber;
              clientNumber = data.clientNumber;
              invoiceAmount = data.invoiceAmount;
              $('#client-form').hide();
              $('#error-client').addClass('d-none');
              $('#error-client').html('');
              $('#show-thanks-client').removeClass('d-none');
              $('#nav-tab-card').removeClass('d-none');
              $('#nav-tab-paypal').removeClass('d-none');
              $('#nav-tab-bank').removeClass('d-none');
              $('#error-paypal').addClass('d-none');

            }
            else if(data.error){
              //show error
              $('#error-client').removeClass('d-none');
              $('#error-client').html(data.error);
            }
            else{
              //something abnormal happened
              $('#error-client').removeClass('d-none');
              $('#error-client').html('Something unexpected happened. Please try again');
            }
          });
          $('#change-info').click(function(e){
            e.preventDefault();

            $('#error-paypal').addClass('d-none');
            $('#client-form').show();
            $('#show-thanks-client').addClass('d-none');
            $('#nav-tab-card').addClass('d-none');
            $('#nav-tab-paypal').addClass('d-none');
            $('#nav-tab-bank').addClass('d-none');
            $('#show-thanks-server').addClass('d-none');
            $('#payment-methods').removeClass('d-none');

          });
  
        }
      });

      $('#card-info').submit(function(e){
        e.preventDefault();
        $('#error-card').addClass('d-none'); 
        errors=0;

        var name = $('#username').val();
        var cardNumber = $('#cardNumber').val();
        var expMonth = $('#expMonth').val();
        var expYear = $('#expYear').val();
        var cvc = $('#cvc').val();

        if(!validateName(name)){
          errors++;
          $('#error-card').removeClass('d-none');  
          $('#error-card').html('You have entered an invalid name format.');  
        }
        if(cardNumber.length<16 || !(Number(cardNumber))){
          errors++;
          $('#error-card').removeClass('d-none');
          $('#error-card').html('The credit card number format is invalid');
        }
        if(expMonth.length > 2 || !(Number(expMonth))){
          errors++;
          $('#error-card').removeClass('d-none');
          $('#error-card').html('The expiry month must be a number and only 2 digits.');
        }
        if(expYear.length > 2 || !(Number(expYear))){
          errors++;
          $('#error-card').removeClass('d-none');
          $('#error-card').html('The expiry year must be a number and only the last 2 digits.');
        }
        if(cvc.length < 3 || cvc.length > 3 || !(Number(cvc))){
          errors++;
          $('#error-card').removeClass('d-none');
          $('#error-card').html('The cvc must be a number and must be 3 digits.');
        }
        if(errors==0){
          $('#nav-tab-card').addClass('d-none');
          $('#payment-spinner').removeClass('d-none');
          if(invoiceNumber && clientNumber){
            let clientInfo = {
              clientNumber: clientNumber,
              invoiceNumber: invoiceNumber,
              cardNumber: cardNumber,
              expMonth: expMonth,
              expYear: expYear,
              cvc: cvc,
              invoiceAmount: invoiceAmount
            };

            $.post('/payments/charge', clientInfo).done(function(data){
              if(data.complete){
                $('#payment-spinner').addClass('d-none');
                $('#nav-tab-card').addClass('d-none');
                $('#error-card').addClass('d-none');
                $('#show-thanks-server').removeClass('d-none'); 
                $('#change-info-warning').removeClass('d-none');
                $('#payment-methods').addClass('d-none'); 
              }
              else if(data.error){
                $('#payment-spinner').addClass('d-none');
                $('#nav-tab-card').removeClass('d-none');
                $('#error-card').removeClass('d-none');
                $('#error-card').html(data.error); 
              }
              else{
                $('#payment-spinner').addClass('d-none');
                $('#nav-tab-card').removeClass('d-none');
                $('#error-card').removeClass('d-none');
                $('#error-card').html('Cannot process payments at this time. Contact your Client Rep.'); 
              }
            });
          }
          else{
            $('#error-card').removeClass('d-none');
            $('#error-card').html('Cannot identify your credentials. Contact Client rep.'); 
          }
        }
      });
});


function validateName(name){
  var re = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/g;
  return re.test(name);
}