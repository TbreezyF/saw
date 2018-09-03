// Replace '../lib/smtp-server' with 'smtp-server' when running this script outside this directory
require('dotenv').config();
require('./server2.js');
require('./server3.js');
require('./server4.js');
const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const mta = require('./models/mta.js');
const utility = require('./models/utility.js');
const fs = require('fs');

const SERVER_PORT = 25;

// Setup server
const server = new SMTPServer({
    // log to console
    logger: false,

    // not required but nice-to-have
    banner: 'SMS V.1',

    key: fs.readFileSync(__dirname + '/sproft_private.pem'),

    cert: fs.readFileSync(__dirname + '/sproft_cert.pem'),

    // disable STARTTLS to allow authentication in clear text mode
    disabledCommands: ['AUTH'],

    // By default only PLAIN and LOGIN are enabled
    authMethods: ['PLAIN', 'LOGIN', 'CRAM-MD5'],

    // Accept messages up to 10 MB
    size: 10 * 1024 * 1024,

    // allow overriding connection properties. Only makes sense behind proxy
    useXClient: true,

    hidePIPELINING: true,

    // use logging of proxied client data. Only makes sense behind proxy
    useXForward: true,

    // Setup authentication
    // Allow only users with username 'testuser' and password 'testpass'
    onAuth(auth, session, callback) {
        callback();
    },

    // Validate MAIL FROM envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onMailFrom(address, session, callback) {
        callback();
    },

    // Validate RCPT TO envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onRcptTo(address, session, callback) {
        if(address.address){
            if(!(utility._validateEmail(address.address))) return callback(new Error('Invalid address type.'));
            if (utility._getHost(address.address) === 'sproft.com') {
                if(utility._verifiedUser(address.address)){
                    return callback();
                }
                return callback(new Error('Not accepted'));
            }
            else{
                return callback(new Error('Not accepted'));
            }
        }
        return callback(new Error('Cannot accept incomplete addresses or unknown formats.'));
    },

    // Handle message stream
    onData(stream, session, callback) {
        let message = '';
        stream.on('data', (chunk)=>{
            message += chunk;
        });
        stream.on('end', async () => {
            let err;
            if (stream.sizeExceeded) {
                err = new Error('Error: message exceeds fixed maximum message size 10 MB');
                err.responseCode = 552;
                return callback(err);
            }

            callback(null, 'Message queued'); // accept the message once the stream is ended
            let mail = await simpleParser(message);
            let received = `Received:  from ${session.remoteAddress} by 
            ${utility._getHost(mail.from.text)} (${session.remoteAddress}) with ESMTPS id ${mail.messageId} for <${mail.to.text}>; ${new Date()}`;
            let domain;
            if(mail.from){
                domain = utility._getHost(mail.from.text);
            }

            if(domain){
                let score = await utility._filter(message, domain);
                message += received;
                let MSG = await simpleParser(message);
                let msg = utility._parseMailForSproft(MSG);
                let sproftUser = utility._getSproftUser(msg.to);
                if(score < 5){
                    //Not SPAM. Put in Inbox
                    try{
                        await mta.toInbox(sproftUser, msg);   
                    }
                    catch(error){
                        console.log(`Could not upate ${sproftUser}'s inbox.`);
                    }
                }
                else{
                    //Place in Spam folder
                    try{
                        await mta.toSpam(sproftUser, msg);   
                    }
                    catch(error){
                        console.log(`Could not upate ${sproftUser}'s spam box.`);
                    }
                    
                }
            }
            else{
                let score = await utility._filter(message, '');
                message += received;
                let MSG = await simpleParser(message);
                let msg = utility._parseMailForSproft(MSG);
                let sproftUser = utility._getSproftUser(msg.to);
                if(score < 5){
                    //Not SPAM. Put in Inbox;
                    try{
                        await mta.toInbox(sproftUser, msg);   
                    }
                    catch(error){
                        console.log(`Could not upate ${sproftUser}'s inbox.`);
                    }
                    
                }
                else{
                    //Place in Spam folder
                    try{
                        await mta.toSpam(sproftUser, msg);   
                    }
                    catch(error){
                        console.log(`Could not upate ${sproftUser}'s spam box.`);
                    }
                    
                }
            }
        });
    }
});

server.on('error', err => {
    console.log('Error occurred');
    console.log(err);
});

// start listening
server.listen(SERVER_PORT);