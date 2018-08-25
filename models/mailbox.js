const AWS = require("aws-sdk");
const util = require("util");

AWS.config.update({
    region: "ca-central-1",
    endpoint: "https://dynamodb.ca-central-1.amazonaws.com"
});

const db = new AWS.DynamoDB.DocumentClient({
    convertEmptyValues: true
});

module.exports = {
    add: async function(user, data, cb){
        let updateItem = [];
        let query = {
            TableName: "Mailbox-Users",
            Key: {
                username: user.username
            }
        };

        let userInfo = await db.get(query).promise();


        if(userInfo.Item){
            if(data.mode){
                switch(data.mode){
                    //add to inbox
                    case 1:
                        let updateMailCount = userInfo.Item.mailbox.newMail + 1;
                        updateItem = userInfo.Item.mailbox.inbox;
                        updateItem.push(data.message);
                        query.UpdateExpression = "set mailbox.inbox = :m, mailbox.newMail = :n";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem,
                            ":n": updateMailCount
                        }
                        await db.update(query).promise();
                        break;
                    //add to sent items
                    case 2:
                        updateItem = userInfo.Item.mailbox.sent;
                        updateItem.push(data.message);
                        query.UpdateExpression = "set mailbox.sent = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //add to drafts
                    case 3:
                        updateItem = userInfo.Item.mailbox.drafts;
                        updateItem.push(data.message);
                        query.UpdateExpression = "set mailbox.drafts = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //add to trash
                    case 4:
                        updateItem = userInfo.Item.mailbox.trash;
                        updateItem.push(data.message);
                        query.UpdateExpression = "set mailbox.trash = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //add to spam
                    case 5:
                        updateItem = userInfo.Item.mailbox.spam;
                        updateItem.push(data.message);
                        query.UpdateExpression = "set mailbox.spam = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    default:
                        return;       
                }
                
                if(cb){
                    return cb()
                }
                else{
                    return new Promise(function(resolve){
                        resolve();
                    });
                }
            }
            else{
                if(cb){
                    return cb(new Error("Invalid MODE attribute. Could not update user mailbox."));
                }
                else{
                    return new Promise(function(resolve, reject){
                        reject(new Error("Invalid MODE attribute. Could not update user mailbox."));
                    });
                } 
            }
        }
        else{
            if(cb){
                return cb(new Error("Invalid OPERATION. User not found."));
            }
            else{
                return new Promise(function(resolve, reject){
                    reject(new Error("Invalid OPERATION. User not found."));
                });
            }
        }
    },
    //END add
    delete: async function(user, data, cb){
        let query = {
            TableName: "Mailbox-Users",
            Key: {
                username: user.username
            }
        };

        let userInfo = await db.get(query).promise();

        if(userInfo.Item){
            if(data.mode){
                switch(data.mode){
                    //delete from inbox
                    case 1:
                        updateItem = userInfo.Item.mailbox.inbox;
                        updateItem.splice(data.index, 1);
                        query.UpdateExpression = "set mailbox.inbox = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //delete from sent items
                    case 2:
                        updateItem = userInfo.Item.mailbox.sent;
                        updateItem.splice(data.index, 1);
                        query.UpdateExpression = "set mailbox.sent = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //delete from drafts
                    case 3:
                        updateItem = userInfo.Item.mailbox.drafts;
                        updateItem.splice(data.index, 1);
                        query.UpdateExpression = "set mailbox.drafts = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //delete from trash
                    case 4:
                        updateItem = userInfo.Item.mailbox.trash;
                        updateItem.splice(data.index, 1);
                        query.UpdateExpression = "set mailbox.trash = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    //delete from spam
                    case 5:
                        updateItem = userInfo.Item.mailbox.spam;
                        updateItem.splice(data.index, 1);
                        query.UpdateExpression = "set mailbox.spam = :m";
                        query.ExpressionAttributeValues = {
                            ":m": updateItem
                        }
                        await db.update(query).promise();
                        break;
                    default:
                        return;       
                }
                if(cb){
                    return cb()
                }
                else{
                    return new Promise(function(resolve){
                        resolve();
                    });
                }
            }
            else{
                if(cb){
                    return cb(new Error("Invalid MODE attribute. Could not update user mailbox."));
                }
                else{
                    return new Promise(function(resolve, reject){
                        reject(new Error("Invalid MODE attribute. Could not update user mailbox."));
                    });
                } 
            }
        }
        else{
            if(cb){
                return cb(new Error("Invalid OPERATION. User not found."));
            }
            else{
                return new Promise(function(resolve, reject){
                    reject(new Error("Invalid OPERATION. User not found."));
                });
            }
        }
    },
    //END delete
    move: async function(user, data){
        //TBD
        return;
    },
    //END move
    retrieve: async function(user, mode, cb){
        let query = {
            TableName: "Mailbox-Users",
            Key: {
                username: user.username
            }
        };

        let userInfo = await db.get(query).promise();

        if(userInfo.Item){
            if(mode){
                let mailbox = [];
                switch(mode){
                    //delete from inbox
                    case 1:
                        mailbox = userInfo.Item.mailbox.inbox;
                        break;
                    //delete from sent items
                    case 2:
                        mailbox = userInfo.Item.mailbox.sent;
                        break;
                    //delete from drafts
                    case 3:
                        mailbox = userInfo.Item.mailbox.drafts;
                        break;
                    //delete from trash
                    case 4:
                        mailbox = userInfo.Item.mailbox.trash;
                        break;
                    //delete from spam
                    case 5:
                        mailbox = userInfo.Item.mailbox.spam;
                        break;
                    default:
                        return;       
                }
                if(cb){
                    return cb(null, {
                        mailbox: mailbox,
                        newMail: userInfo.Item.mailbox.newMail
                    });
                }
                else{
                    return new Promise(function(resolve){
                        resolve({
                            mailbox: mailbox,
                            newMail: userInfo.Item.mailbox.newMail
                        });
                    });
                }
            }
            else{
                if(cb){
                    return cb(new Error("Invalid MODE attribute. Could not retrieve user mailbox."));
                }
                else{
                    return new Promise(function(resolve, reject){
                        reject(new Error("Invalid MODE attribute. Could not retrieve user mailbox."));
                    });
                } 
            }
        }
        else{
            if(cb){
                return cb(new Error("Invalid OPERATION. User not found."));
            }
            else{
                return new Promise(function(resolve, reject){
                    reject(new Error("Invalid OPERATION. User not found."));
                });
            }
        }
    },//END retrieve
    getMail: async function(user, mode, indexString, cb){
        let mail = {};
        let box  =[];
        if(user && mode && indexString){
            let index = Number(indexString);
            let query = {
                TableName: 'Mailbox-Users',
                Key: {
                    username: user.username
                }
            };

            let userInfo = await db.get(query).promise();
            if(userInfo.Item){
                switch(mode){
                    //GET from inbox
                    case 1:
                        box = userInfo.Item.mailbox.inbox;
                        mail = userInfo.Item.mailbox.inbox[index];
                        mail.read = true;
                        box[index] = mail;
                        query = {
                            TableName: 'Mailbox-Users',
                            Key: {
                                username: user.username
                            },
                            UpdateExpression: 'set mailbox.inbox = :box',
                            ExpressionAttributeValues: {
                                ':box': box
                            }
                        };
                        break;
                    //GET from sent
                    case 2:
                        box = userInfo.Item.mailbox.sent;
                        mail = userInfo.Item.mailbox.sent[index];
                        mail.read = true;
                        box[index] = mail;
                        query = {
                            TableName: 'Mailbox-Users',
                            Key: {
                                username: user.username
                            },
                            UpdateExpression: 'set mailbox.sent = :box',
                            ExpressionAttributeValues: {
                                ':box': box
                            }
                        };
                        break;
                    //GET from drafts
                    case 3:
                        box = userInfo.Item.mailbox.drafts;
                        mail = userInfo.Item.mailbox.drafts[index];
                        mail.read = true;
                        box[index] = mail;
                        query = {
                            TableName: 'Mailbox-Users',
                            Key: {
                                username: user.username
                            },
                            UpdateExpression: 'set mailbox.drafts = :box',
                            ExpressionAttributeValues: {
                                ':box': box
                            }
                        };
                        break;
                    //GET from trash
                    case 4:
                        box = userInfo.Item.mailbox.trash;
                        mail = userInfo.Item.mailbox.trash[index];
                        mail.read = true;
                        box[index] = mail;
                        query = {
                            TableName: 'Mailbox-Users',
                            Key: {
                                username: user.username
                            },
                            UpdateExpression: 'set mailbox.trash = :box',
                            ExpressionAttributeValues: {
                                ':box': box
                            }
                        };
                        break;
                    //GET from spam
                    case 5:
                        box = userInfo.Item.mailbox.spam;
                        mail = userInfo.Item.mailbox.spam[index];
                        mail.read = true;
                        box[index] = mail;
                        query = {
                            TableName: 'Mailbox-Users',
                            Key: {
                                username: user.username
                            },
                            UpdateExpression: 'set mailbox.spam = :box',
                            ExpressionAttributeValues: {
                                ':box': box
                            }
                        };
                        break;
                }
                if(cb){
                    //update DB
                    if(query.UpdateExpression){
                        await db.update(query).promise();
                    }
                    cb(null, {
                        message: mail,
                        newMail: userInfo.Item.mailbox.newMail
                    });
                }
                else{
                    let obj = {
                        message: mail,
                        newMail: userInfo.Item.mailbox.newMail
                    }
                    //update DB
                    if(query.UpdateExpression){
                        await db.update(query).promise();
                    }
                    return obj;
                }
            }
            else{
                if(cb){
                    cb(new Error('ERROR: Cannot find user.'));
                }
                else{
                    return new Error('ERROR: Cannot find user.');
                }  
            }
        }   
        else{
            if(cb){
                cb(new Error('ERROR: Cannot retrieve mail. Incomplete parameters'));
            }
            else{
                return new Error('ERROR: Cannot retrieve mail. Incomplete parameters');
            }
        }
    }
}//END module