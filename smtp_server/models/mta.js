const mailbox = require('./mailbox.js');
const SMTPConnection = require('nodemailer/lib/smtp-connection');
const MailComposer = require('nodemailer/lib/mail-composer');
const util = require('util');
const fs = require('fs');
const utility = require('./utility.js');
const transporter = require('./sendmail.js');

module.exports = {
    toMSA: async function(port, email){
        if(port && email){
            if(email.date){
                delete email.date;
            }
            let connectionOptions = {
                port: port,
                logger: false,
                debug: false,
                authMethod: 'PLAIN'
            }
            let connection = new SMTPConnection(connectionOptions);
            let envelope = {};

            if(utility._parseRecipients(email.to)){
                    envelope = {
                    from: email.from,
                    to: utility._parseRecipients(email.to),
                    dsn: {
                        ret: 'HDRS',
                        notify: 'SUCCESS'
                    }
                };
            }

            let mail = new MailComposer(email);

            mail.compile().build((err, message)=>{
                if(err) console.log('ERROR Composing Message: \n' + error);
                connection.connect(()=>{
                    connection.send(envelope, message, (err, info)=>{
                        if(err) console.log('ERROR: Sending Message: \n' + err);
                        console.log('RECEIVED INFO: \n' + util.inspect(info));
                        connection.quit();
                    });
                });
            });
        }
        return;
    },
    toMTA: async function(port, email){

        console.log('\nPreparing to transfer emails...')

        let agent = transporter({
            logger: {
              debug: console.log,
              info: console.info,
              warn: console.warn,
              error: console.error
            },
            silent: false,
            dkim: { // Default: False
              privateKey: fs.readFileSync(__dirname + '/dkim-private.pem', 'utf8'),
              keySelector: '1535443268.sproft'
            },
            devPort: 25,
            smtpPort: port // Default: 25
          });

          console.log('\ntransfering...');
          console.dir(email);
          agent(email, function(err, res){
            if(err){
                console.log('\nERROR sending mail:\n' + err);
            }
            console.log('\nServer response:\n' + res);
          });
    },

    toInbox: async function(username, message){
        let user = {
            username: username
        };
        let data = {
            mode: 1,
            message: message
        };

        await mailbox.add(user, data);
        return;
    }, 
    toSpam: async function(username, message){
        let user = {
            username: username
        };
        let data = {
            mode: 5,
            message: message
        };

        await mailbox.add(user, data);
        return;
    },
    toSentItems: async function(username, message){
        let user = {
            username: username
        };
        let data = {
            mode: 2,
            message: message
        };

        await mailbox.add(user, data);
        return;
    }
}