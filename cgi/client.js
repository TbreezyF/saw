const mta = require('../models/transferAgent.js');
module.exports = {
    sendmail: async function(user, email){

        console.log('\nPreparing message contents...');

        let sanitized_recipients = email.to.toString().replace(/;/g, ',' );
        sanitized_recipients = sanitized_recipients.replace(/\s/g, '');
        
        console.log('\nSanitized Recipients: \n' + sanitized_recipients);
        let date = new Date();
        let messageConfig = {
            from: `${user.username}@sproft.com`,
            to: sanitized_recipients,
            cc: email.cc,
            subject: email.subject,
            replyTo: `${user.username}@sproft.com`,
            text: email.body_text,
            html: email.body_html,
            sender: 'smtp.sproft.com',
            date: {
                hours: date.getHours(),
                minutes: date.getMinutes(),
                day: date.getDay(),
                month: date.getMonth(),
                year: date.getFullYear(),
                seconds: date.getSeconds(),
                utcDate: date.getUTCDate()
            }
        };

        console.log('\nSending Mail...');
        try{
            await mta.handleSproftOutbound(user.username, messageConfig);
            delete messageConfig.date;
            await mta.transferMail(messageConfig);
            console.log('Mail sent.');
        }
        catch(error){
            console.log(error);
        }

    }
}