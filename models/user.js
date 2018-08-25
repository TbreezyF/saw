const bcrypt = require('bcrypt');
const saltRounds = 12;
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
    add: function(email, username, fname, lname, domain, password, cb) {
        if (email && username && fname && lname && domain && password) {
            let mailboxData = {
                TableName: 'Mailbox-Users',
                Item: {
                    username: username,
                    email: email,
                    mailbox: {
                        inbox: [],
                        sent: [],
                        trash: [],
                        spam: [],
                        drafts: [],
                        newMail: 0
                        }
                }
            };
            bcrypt.hash(password, saltRounds, async function(err, hash) {
                let userData = {
                    TableName: 'Sproftmail-Users',
                    Item: {
                        username: username,
                        email: email,
                        first_name: fname,
                        last_name: lname,
                        username: username,
                        password: hash,
                        domain: domain
                    }
                };
                console.log('Adding new user to Sproft mail..');
                await db.put(userData).promise();
                await db.put(mailboxData).promise();

                if (cb) {
                    cb(null, {
                        email: email,
                        username: username,
                        domain: domain
                    });
                } else {
                    return new Promise(function(resolve, reject) {
                        resolve({
                            email: email,
                            username: username,
                            domain: domain
                        });
                    });
                }
            });
        } else {
            if (cb) {
                cb(new Error(`Error occured while creating user ${email}`));
                return;
            }
            return new Promise(function(resolve, reject) {
                reject(new Error(`Error occured while creating user ${email}`));
            })
        }
    },
    remove: async function(username, email, cb) {
        let user = {
            TableName: 'Sproftmail-Users',
            Key: {
                username: username
            }
        };
        let mailbox = {
            TableName: 'Mailbox-Users',
            Key: {
                username: username
            }
        }
        console.log(`Deleting user ${username}...`);
        try {
            await db.delete(user).promise();
            await db.delete(mailbox).promise();
            console.log('User and all associated emails have been deleted.');

            if (cb) {
                cb(null);
            } else {
                return null;
            }
        } catch (error) {
            if (cb) {
                cb(error);
            } else {
                return error;
            }
        }
    },
    updateUser: function(email, options, cb) {
        return;
    },
    authenticate: async function(username, password, cb) {
        if (username) {
            console.log('\nAuthenticating user...');
            let user = {
                TableName: 'Sproftmail-Users',
                Key: {
                    username: username
                }
            };

            try {
                let userInfo = await db.get(user).promise();
                if (userInfo.Item) {
                    console.log('\nUser found...');
                    let hash = userInfo.Item.password;
                    if (await bcrypt.compare(password, hash)) {
                        if (cb) {
                            console.log('\nUser credentials verified.');
                            cb(null, {
                                email: userInfo.Item.email,
                                username: userInfo.Item.username,
                                domain: userInfo.Item.domain
                            });
                        } else {
                            console.log('\nUser credentials verified.');
                            return new Promise(function(resolve) {
                                resolve({
                                    email: userInfo.Item.email,
                                    username: userInfo.Item.username,
                                    domain: userInfo.Item.domain
                                });
                            });
                        }
                    }
                } else {
                    if (cb) {
                        cb(new Error('User not found.'));
                        console.log('\nAuthentication failed.');
                    } else {
                        return new Promise(function(resolve, reject) {
                            reject(new Error('User not found'));
                            console.log('\nAuthentication failed.');
                        });
                    }
                }
            } catch (error) {
                if (cb) {
                    cb(new Error('Could not authenticate user...possible DB error'));
                    console.log('\nAuthentication failed.');
                } else {
                    return new Promise(function(resolve, reject) {
                        reject(new Error('Could not authenticate user...possible DB error'));
                        console.log('\nAuthentication failed.');
                    });
                }
            }

        } else {
            if (cb) {
                cb(new Error('User email must be provided'));
            } else {
                return new Promise(function(resolve, reject) {
                    reject(new Error('User email must be provided'));
                })
            }
        }
    },
    fetch: async function(username, cb){
        let query = {
            TableName: 'Mailbox-Users',
            Key: {
                username: username
            }
        };

        let user = await db.get(query).promise();

        if(user.Item){
            let response = {
                username: user.Item.username,
                email: user.Item.email
            };
            if(cb){
                cb(null,response);
            }
            else{
                return response;
            }
        }
        else{
            if(cb){
                cb(new Error('BAD REQUEST: User not found in database.'));
            }else{
                return new Error('BAD REQUEST: User not found in database.');
            }
        }
    },
    cleanUp: async function(user){
        let query = {
            TableName: 'Mailbox-Users',
            Key:{
                username: user.username
            },
            UpdateExpression: 'set mailbox.newMail = :n',
            ExpressionAttributeValues: {
                ':n': 0
            }
        };

        await db.update(query).promise();
        return;
    }
};