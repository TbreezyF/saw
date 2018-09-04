const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const request = require('request-promise');
const util = require('util');

AWS.config.update({
    region: "ca-central-1",
    endpoint: "https://dynamodb.ca-central-1.amazonaws.com"
});

const db = new AWS.DynamoDB.DocumentClient({
    convertEmptyValues: true
});

const stripe = require("stripe")(process.env.STRIPE_KEY);

router.get('/', (req, res)=>{
    return res.status(200).render('payments');
});

router.post('/paypal', async(req,res)=>{
    let CLIENT = process.env.PAYPAL_CLIENT_ID;
    let SECRET = process.env.PAYPAL_SECRET;
    let PAYPAL_API = 'https://api.paypal.com';

    if(req.query.auth == 'paypal' && req.query.amount){
        let PAYMENT_INFO = {
            auth:
            {
              user: CLIENT,
              pass: SECRET
            },
            body:
            {
              intent: 'sale',
              payer:
              {
                payment_method: 'paypal'
              },
              transactions: [
              {
                amount:
                {
                  total: req.query.amount,
                  currency: 'CAD'
                }
              }],
              redirect_urls:
              {
                return_url: 'https://sproft.com/payments/',
                cancel_url: 'https://sproft.com/payments/'
              }
            },
            json: true
          };

          try{
            let response = await request.post(PAYPAL_API + '/v1/payments/payment', PAYMENT_INFO);
            console.log('\nRESPONSE ID: ' + response.id);
            return res.json({
                id: response.id
            });
          }
          catch(error){
            console.log('\nPAYPAL PAYMENTS ERROR: ' + error);
            return res.sendStatus(500);
          }
    }
    else{
        return res.status(403).redirect('https://sproft.com');
    }
});

router.post('/paypal/execute', async(req, res)=>{
    let CLIENT = process.env.PAYPAL_CLIENT_ID;
    let SECRET = process.env.PAYPAL_SECRET;
    let PAYPAL_API = 'https://api.paypal.com';
    if(req.query.auth=='paypal' && req.query.amount){
        let paymentID = req.body.paymentID;
        let payerID = req.body.payerID;
    
        let PAYMENT_INFO = {
            auth:
            {
              user: CLIENT,
              pass: SECRET
            },
            body:
            {
              payer_id: payerID,
              transactions: [
              {
                amount:
                {
                  total: req.query.amount,
                  currency: 'CAD'
                }
              }]
            },
            json: true
          };

          try{
            let response = await request.post(PAYPAL_API + '/v1/payments/payment/' + paymentID + '/execute', PAYMENT_INFO);
            res.json({
                status: 'success'
            });
            let invoiceAmount = req.query.amount;
            let clientNumber = req.query.id;
            let invoiceNumber = Number(req.query.invoiceNumber);

            let query = {
                TableName: 'SproftMedia-Clients',
                Key: {
                    clientNumber: Number(clientNumber)
                }
            };

            let clientInfo = await db.get(query).promise();
            if(clientInfo.Item){
                let invoices = clientInfo.Item.invoices;
                let invoiceBalance, invoice, index;

                for(let i=0; i<invoices.length; i++){
                    if(invoices[i].invoiceNumber == invoiceNumber){
                        invoiceBalance = Number(invoices[i].balance);
                        index = i;
                        break;
                    }
                }
                
                invoiceBalance -= Number(invoiceAmount);
                invoices[index].balance = invoiceBalance;
                let charges = invoices[index].charges;
                charges.push(paymentID);
                invoices[index].charges = charges;
                let totalBalance = 0;

                for(let i=0; i<invoices.length; i++){
                    totalBalance += invoices[i].balance;
                }

                let query = {
                    TableName: 'SproftMedia-Clients',
                    Key: {
                        clientNumber: Number(clientNumber)
                    },
                    UpdateExpression: 'set invoices = :i, totalBalance = :b',
                    ExpressionAttributeValues: {
                        ':i': invoices,
                        ':b': totalBalance
                    }
                };

                await db.update(query).promise();
            }
          }
          catch(error){
            console.log('\nPAYPAL PAYMENTS ERROR: ' + error);
            return res.json({
                error: true
            });
          }
    }
    else{
        return res.status(403).redirect('https://sproft.com'); 
    }
});

router.post('/charge', async (req, res)=>{
    if(req.body){
        let {clientNumber, invoiceNumber, cardNumber, expMonth, expYear, cvc, invoiceAmount} = req.body;

        stripe.tokens.create({
            card: {
                number: cardNumber.toString(),
                exp_month: Number(expMonth),
                exp_year: Number(expYear),
                cvc: cvc.toString()
            }
        }, async function(err, token){
           if(err){
            console.log('\nSTRIPE PAYMENT ERROR: ' + err.message);
            return res.status(200).json({error: err.message});
           }
           else{
            //Get Invoice Balance
            let query = {
                TableName: 'SproftMedia-Clients',
                Key: {
                    clientNumber: Number(clientNumber)
                }
            };

            let clientInfo = await db.get(query).promise();

            if(clientInfo.Item){
                let invoices = clientInfo.Item.invoices;
                let invoiceBalance, invoice, index;

                for(let i=0; i<invoices.length; i++){
                    if(invoices[i].invoiceNumber == invoiceNumber){
                        invoiceBalance = Number(invoices[i].balance);
                        index = i;
                        break;
                    }
                }

                //charge card and apply to invoice
                stripe.charges.create({
                    amount: Number(invoiceAmount) * 100,
                    currency: 'cad',
                    source: token.id,
                    description: `This charge was applied to Client Number: ${clientNumber} for invoice no. ${invoiceNumber}`,
                    capture: true,
                    receipt_email: clientInfo.Item.email
                }, async function(err, charge){
                    if(err){
                        console.log('STRIPE PAYMENT ERROR: ' + err.message);
                        return res.status(200).json({error: err.message})
                    }
                    else{
                        if(charge.status == 'succeeded' && charge.paid == true){
                            invoiceBalance -= Number(charge.amount);
                            invoices[index].balance = invoiceBalance;
                            let charges = invoices[index].charges;
                            charges.push(charge.id);
                            invoices[index].charges = charges;
                            let totalBalance = 0;

                            for(let i=0; i<invoices.length; i++){
                                totalBalance += invoices[i].balance;
                            }

                            let query = {
                                TableName: 'SproftMedia-Clients',
                                Key: {
                                    clientNumber: Number(clientNumber)
                                },
                                UpdateExpression: 'set invoices = :i, totalBalance = :b',
                                ExpressionAttributeValues: {
                                    ':i': invoices,
                                    ':b': totalBalance
                                }
                            };

                            await db.update(query).promise();
                            return res.status(200).json({complete: true});
                        }
                        else{
                            return res.status(200).json({error: 'Something went wrong trying to apply this charge.'});
                        }
                    }
                });
            }
           } 
        });
    }
    else{
        return res.end();
    }
});

router.post('/clients', async(req, res)=>{
    let client, email, number, invoice, error, amount;
    if(req.body){
        client = req.body;
        if(client.email && client.number && client.invoice){
            email = client.email;
            number = client.number;
            invoice = client.invoice;
            amount = client.amount;

            if(Number(number) && Number(invoice) && validateEmail(email)){
                let query = {
                    TableName: 'SproftMedia-Clients',
                    Key: {
                        clientNumber: Number(number)
                    }
                };
                let clientInfo = await db.get(query).promise();
                if(clientInfo.Item){
                    let invoices = clientInfo.Item.invoices;
                    let totalBalance = clientInfo.Item.totalBalance;
                    if(invoices.length < 1 || totalBalance <= 0){
                        error = "You don't appear to have any outstanding invoices.";
                        return res.status(200).json({error: error});   
                    }
                    else{
                        for(let i=0; i<invoices.length; i++){
                            if(invoices[i].invoiceNumber == invoice){
                                return res.status(200).json({verified: true, invoiceNumber: invoice, clientNumber: number, invoiceAmount: amount});
                            }
                        }
                        error = "We can't find an invoice with that number.";
                        return res.status(200).json({error: error});  
                    }
                }
                else{
                    error = "You don't appear to be a client.";
                    return res.status(200).json({error: error});  
                }
            }
            error = "Some of the information is incorrect.";
            return res.status(200).json({error: error});  
        }
        error = "Some of the information is incorrect.";
        return res.status(200).json({error: error});   
    }
    else{
        error = "Some of the information is incorrect.";
        return res.status(200).json({error: error}); 
    }
});
module.exports = router;

function validateEmail(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}