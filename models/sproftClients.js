const AWS = require('aws-sdk');
const util = require('util');

AWS.config.update({
    region: "ca-central-1",
    endpoint: "https://dynamodb.ca-central-1.amazonaws.com"
});

const db = new AWS.DynamoDB.DocumentClient({
    convertEmptyValues: true
});

module.exports = {
    getClient: async function(clientNumber){

    },
    updateBalance: async function(clientNumber, amountPaid){
        
    }
}