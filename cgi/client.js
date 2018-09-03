const mta = require('../models/mta.js');
module.exports = {
    sendmail: async function(user, email){

        console.log('\nPreparing message contents...');

        let sanitized_recipients = email.to.toString().replace(/;/g, ',' );
        sanitized_recipients = sanitized_recipients.replace(/\s/g, '');
        
        let date = new Date();
        let messageConfig = {
            from: `${user.username}@sproft.com`,
            to: sanitized_recipients,
            cc: email.cc,
            subject: email.subject,
            replyTo: `${user.username}@sproft.com`,
            text: email.body_text,
            html: email.body_html,
            sender: `${user.username}@sproft.com`,
            date: {
                hours: date.getHours(),
                minutes: date.getMinutes(),
                day: date.getDay(),
                month: date.getMonth(),
                year: date.getFullYear(),
                seconds: date.getSeconds(),
                utcDate: date.getUTCDate()
            },
            attachments: email.attachments
        };

        console.log('\nSending Mail to SMS V.1.2...');

        try{
            await mta.toMSA(2525, messageConfig);
        } 
        catch(error){
            console.log('ERROR: \n' + error);
        }

    }
}