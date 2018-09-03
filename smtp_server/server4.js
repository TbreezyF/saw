// Replace '../lib/smtp-server' with 'smtp-server' when running this script outside this directory
require('dotenv').config();
const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const user = require('./models/user.js');
const mta = require('./models/mta.js');
const fs = require('fs');
const utility = require('./models/utility.js');

const SERVER_PORT = 2525;

// Setup server
const server = new SMTPServer({
    // log to console
    logger: true,

    // not required but nice-to-have
    banner: 'SMS V.4',

    secure: false,

    // By default only PLAIN and LOGIN are enabled
    authMethods: ['PLAIN', 'LOGIN', 'CRAM-MD5'],

    // Accept messages up to 10 MB
    size: 10 * 1024 * 1024,

    disabledCommands: ['STARTTLS'],

    authOptional: true,

    // allow overriding connection properties. Only makes sense behind proxy
    useXClient: true,

    hidePIPELINING: false,

    // use logging of proxied client data. Only makes sense behind proxy
    useXForward: true,

    // Setup authentication
    // Allow only users with username 'testuser' and password 'testpass'
    onAuth(auth, session, callback) {
        // Check if auth request if from Sproft Mail Client
        let username = process.env.SERVER_USER;
        let password = process.env.SERVER_PASS
        if (
            auth.username === username &&
            (auth.method === 'CRAM-MD5' ?
                auth.validatePassword(password) // if cram-md5, validate challenge response
                :
                auth.password === password) // for other methods match plaintext passwords
        ) {
            return callback(null, {
                user: session.id // value could be an user id, or an user object etc. This value can be accessed from session.user afterwards
            });
        }

        //Request is from a different mail client - User must be a sproft user to submit mail on this server.
        let authenticated = (async function(){
            await user.authenticate(auth.username, auth.password);
        })();

        if(authenticated && authenticated.username){
            return callback(null, {
                user: session.id // value could be an user id, or an user object etc. This value can be accessed from session.user afterwards
            });  
        }
        return callback(new Error('Authentication failed'));
    },

    // Validate MAIL FROM envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onMailFrom(address, session, callback) {
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

    // Validate RCPT TO envelope address. Example allows all addresses that do not start with 'deny'
    // If this method is not set, all addresses are allowed
    onRcptTo(address, session, callback) {
        if(!(utility._validateEmail(address.address))){
            return callback(new Error('Invalid address type.'));
        }
        callback();
    },

    // Handle message stream
    onData(stream, session, callback) {
        simpleParser(stream, async (err, mail)=>{
            if(err){
                console.log('\nERROR: Error parsing mail \n' + err);
                callback(new Error('Invalid Mail Format.'));
            }

            let message = {};
            message = utility._cleanMail(mail);
            message = utility._cleanMail(message, 'cc');
            message = utility._cleanMail(message, 'bcc');
            console.log('\nMail is authorized, transfering to MTA...');
            try{
                await mta.toMTA(587, utility._parseMailObject(message));
                console.log('\nTransfer completed.');
                await mta.toSentItems(utility._getSproftUser(mail.from.text), utility._parseMailForSproft(mail));
            }
            catch(error){
                console.log('\nMTA ERROR: \n' + error);
            }
        });
        stream.on('end', () => {
            let err;
            if (stream.sizeExceeded) {
                err = new Error('Error: message exceeds fixed maximum message size 10 MB');
                err.responseCode = 552;
                return callback(err);
            }
            callback(null, 'Message queued'); // accept the message once the stream is ended
        });
    }
});

server.on('error', err => {
    console.log('Error occurred');
    console.log(err);
});

// start listening
server.listen(SERVER_PORT);