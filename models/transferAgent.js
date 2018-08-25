const mailbox = require('./mailbox.js');
const mta_instance = require('sendmail');
const fs = require('fs');

module.exports = {
    transferMail: async function(message, cb){
        if(message && message instanceof Object){
            if(message.cc === ''){
                delete message.cc;
            }
            if(message.date){
                delete message.date
            }
            if(message.headers){
                delete message.headers
            }
            
            let mta = mta_instance({
                logger: {
                    debug: console.log,
                    info: console.info,
                    warn: console.warn,
                    error: console.error
                },
                dkim: { 
                    privateKey: fs.readFileSync(__dirname + '/dkim-private.pem', 'utf8'),
                    keySelector: 'sms'
                },
                silent: false,
                devPort: 2525,
                devHost: 'localhost',
                smtpPort: 2525,
                smtpHost: 'localhost'
            });

            mta(message, async function(err, response){
                if(err){
                    if(cb){
                        cb(new Error('Unable to send mail to other MTA not on this server'));
                    }
                    else{
                        return new Error('Unable to send mail to other MTA not on this server');
                    }
                }
                else{
                    console.log('\nMail Transfered.');
                    console.log('\nServer response: \n' + response );
                }
            });

        }
        else{
            if(cb){
                cb(new Error('Cannot find/verify message object.'));
            }
            else{
                return new Error('Cannot find/verify message object.');
            }
        }
    },
    handleSproftInbound: async function(username, message, cb){
        //verifyUsername
        //TODO: Filter message for Spam, verify sender (DKIM, SPF, DMARC)
        if(message && message instanceof Object){
            try{
                let data = {
                    mode: 1,
                    message: message
                }

                let user = {
                    username: username
                }
                await mailbox.add(user, data);
                if(cb){
                    cb();
                }
                else{
                    return;
                }
            }
            catch(error){
                if(cb){
                    cb(new Error('Unable to receive incoming mail.'));
                }
                else{
                    return new Error('Unable to receive incoming mail.');
                }
            }
        }
        else{
            if(cb){
                cb(new Error('Cannot find/verify message object.'));
            }
            else{
                return new Error('Cannot find/verify message object.');
            }
        }
    },
    handleSproftOutbound: async function(username, message, cb){
        //TODO: Filter message for Spam
        if(message && message instanceof Object){
                let data = {
                    mode: 2,
                    message: message
                }
                let user = {
                    username: username
                }
                await mailbox.add(user,data);
            }
            else{
                if(cb){
                    cb(new Error('Cannot find/verify message object.'));
                }
                else{
                    return new Error('Cannot find/verify message object.');
                }
            }
    },
    parseRecipients: async function(list, cb){
        let recipients;
        if(list){
            list = list.toString().replace(/\s+/g, '');
            recipients = list.split(',');
            if(cb){
                cb(null, recipients);
            }
            else{
                return recipients;
            }
        }
        else{
            if(cb){
                cb(new Error('CONTENT ERROR: List not provided.'));
            }
            else{
                return new Error('CONTENT ERROR: List not provided.');
            }
        }
    }
} //END Exported module

async function checkSpam(){

}

async function checkVirus(){

}