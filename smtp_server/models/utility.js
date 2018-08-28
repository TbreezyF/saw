
const user = require('./user.js');
const MailComposer = require('nodemailer/lib/mail-composer');
const DKIM = require('./dkim.js');
const SPFValidator = require('spf-validator');
const request = require('request-promise');
const util = require('util');
module.exports = {
    _getSproftUser: function(email){
        let username;
        username = email.toString().substring(0, email.toString().indexOf('@'));
        return username;
    },
    _getHost: function(email){
        const m = /[^@]+@([\w\d\-\.]+)/.exec(email);
        return m && m[1];
    },
    _verifiedUser: async function(email){
        let userInfo = await user.fetch(await _getUser(email));
        if(userInfo.username){
            return true;
        }
        else{
            return false;
        }
    },
    _validateEmail: function(email){
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }, 
    _parseRecipients: function(list){
        let recipients = [];
        if(list){
            list = list.toString().replace(/\s+/g, '');
            list = list.replace(/[;]/, ',');
            recipients = list.split(',');
            return recipients;
        }
        else{
            return new Error('CONTENT ERROR: List not provided.');  
        } 
    },
    _cleanMail: function(mail, field){
        let recipients = [];
        let validRecipients = [];
        let anchor = mail.to;

        if(field && field == 'cc'){
            anchor = mail.cc
        }
        if(field && field == 'bcc'){
            anchor = mail.bcc
        }
        if(anchor && anchor.text.toString().length >= 1){
            recipients = _parseRecipients(anchor.text);
            if(recipients.length > 0){
                for(var i=0; i<recipients.length; i++){
                    if(_validateEmail(recipients[i])){
                        validRecipients.push(recipients[i]);
                    }
                }
            }
            else{
                return mail;  
            }
            if(field && field == 'cc'){
                mail.cc = validRecipients.toString();
                return mail;
            }
            if(field && field == 'bcc'){
                mail.bcc = validRecipients.toString();
                return mail;
            }
                mail.to = validRecipients.toString();
                return mail;
            
        }
        else{
            return mail;
        }
    },
    _parseMail: function(mail){
        return new Promise(function(resolve, reject){
            let message = {};
            let email;
            if(mail && mail.to && mail.from){
                message.from = mail.from.text;
                message.to = mail.to;
                message.sender = mail.from.text;
                if(mail.cc) message.cc = mail.cc.text;
                if(mail.bcc) message.bcc = mail.bcc.text;
                message.replyTo = mail.from.text;
                message.subject = mail.subject;
                message.text = mail.text;
                message.html = mail.html || mail.textAsHtml;
                message.attachments = mail.attachments;
                message.date = mail.date;
            }

                email = new MailComposer(message);
                email.compile().build((err, msg)=>{
                    if(err){
                        console.log('ERROR Composing outgoing email: \n' + err);
                        reject(err);
                    }
                    resolve(msg);
                });
            });
    },
    _parseMailWithDKIM: function(mail){
        return new Promise(function(resolve, reject){
            let message = {};
            let dkim;
            let email;

            if(mail.headers.has('dkim-signature')){
                dkim = 'DKIM-Signature:' +  mail.headers.get('dkim-signature');
            }
            if(mail && mail.to && mail.from){
                message.from = mail.from.text;
                message.to = mail.to;
                message.sender = mail.from.text;
                if(mail.cc) message.cc = mail.cc.text;
                if(mail.bcc) message.bcc = mail.bcc.text;
                message.replyTo = mail.from.text;
                message.subject = mail.subject;
                message.text = mail.text;
                message.html = mail.html || mail.textAsHtml;
                message.attachments = mail.attachments;
                message.date = mail.date;
            }

                email = new MailComposer(message);
                email.compile().build((err, msg)=>{
                    if(err){
                        console.log('ERROR Composing outgoing email: \n' + err);
                        reject(err);
                    }
                    if(dkim){
                        msg += dkim + '\r\n';
                    }
                    resolve(msg);
                });
            });
    },
    _parseMailObject: function(mail){
        let message = {};
        if(mail && mail.to && mail.from){
            message.from = mail.from.text;
            message.to = mail.to;
            message.sender = mail.from.text;
            if(mail.cc) message.cc = mail.cc.text;
            if(mail.bcc) message.bcc = mail.bcc.text;
            message.replyTo = mail.from.text;
            message.subject = mail.subject;
            message.text = mail.text;
            message.html = mail.html || mail.textAsHtml;
            message.attachments = mail.attachments;
            message.date = mail.date;
        }
        return message;
    },
    _validateDKIM: async function(email){
        if(email){
            return new Promise(function(resolve, reject){
                console.log('\nVerifying DKIM of incoming...\n');
                DKIM.DKIMVerify(email, (err, sigs)=>{
                    if(err){
                        console.log('\nERROR: Invalid DKIM Signature\n' + err);
                    }
                    if(sigs.result){
                        console.log('\nDKIM Pass\n');
                        resolve(true);
                    }
                    reject(false);
                }); 
            }); 
        }
        return false;
    },
    _hasSPF: async function(domain){
        return new Promise(function(resolve, reject){
            if(domain){
                let validator = new SPFValidator(domain);
                validator.hasRecords((err, records)=>{
                    if(err){
                        reject(false);
                    }
                    console.log('\nAVAIL. SPF Records: \n' + records);
                    resolve(true);
                });
            }
        });
    },
    _filter: async function(message, domain, remoteAddress){
        let flags = 3;
        if(message && domain){
            try{
                if(!(await _validateDKIM(message))){
                    flags +=2;
                }
                else{
                    flags -=1;
                }
                if(!(await _hasSPF(domain))){
                    flags +=2;
                }
                else{
                    //do nothing
                }
            }
            catch(error){
                console.log('DKIM/SPF Validation failed.')
            }
            console.log('\nChecking for spam...\n');
            let checkSpam = {
                email: message,
                options: 'long'
            }

            try{
                let score = await request.post({
                    uri: 'https://spamcheck.postmarkapp.com/filter',
                    json: true,
                    body: checkSpam
                });
    
                if(score.score){
                    let spamScore = Number(score.score);
                    flags+=spamScore;
                }
            }
            catch(error){
                console.log('ERROR connecting to spamAssassin');
            }
            console.log('\nDone.');
            return flags;
        }
        return flags;
    },
    _parseMailForSproft: function(mail){
        let message = {};
        let date = new Date();
        let sproftDate = {
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds(),
            day: date.getDay(),
            month: date.getMonth(),
            year: date.getFullYear(),
            utcDate: date.getUTCDate()
        };
        if(mail && mail.to && mail.from){
            message.headers = Array.from(mail.headers);
            message.from = mail.from.text;
            message.to = mail.to.text;
            message.sender = mail.from.text;
            if(mail.cc) message.cc = mail.cc.text;
            if(mail.bcc) message.bcc = mail.bcc.text;
            message.replyTo = mail.from.text;
            message.subject = mail.subject;
            message.text = mail.text;
            message.html = mail.html || mail.textAsHtml;
            message.attachments = mail.attachments;
            message.date = mail.date;
            message.sproftDate = sproftDate;
        }
        return message;
    }

}//END MODULE/UTILITY

function _getUser(email){
    let username;
    username = email.toString().substring(0, email.toString().indexOf('@'));
    return username;
}

function _parseRecipients(list){
    let recipients = [];
    if(list){
        list = list.toString().replace(/\s+/g, '');
        list = list.replace(/[;]/, ',');
        recipients = list.split(',');
        return recipients;
    }
    else{
        return new Error('CONTENT ERROR: List not provided.');  
    } 
}

function _validateEmail(email){
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function _validateDKIM(email){
    if(email){
        return new Promise(function(resolve, reject){
            console.log('\nVerifying DKIM of incoming...\n');
            DKIM.DKIMVerify(email, (err, sigs)=>{
                if(err){
                    console.log('\nERROR: Invalid DKIM Signature\n' + err);
                }
                if(sigs.result){
                    console.log('\nDKIM Pass\n');
                    resolve(true);
                }
                reject(false);
            }); 
        }); 
    }
    return false;
}

function _hasSPF(domain){
    return new Promise(function(resolve, reject){
        if(domain){
            let validator = new SPFValidator(domain);
            validator.hasRecords((err, records)=>{
                if(err){
                    reject(false);
                }
                resolve(true);
            });
        }
    });
}

function _isURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return pattern.test(str);
}

function _isIP(ipAddress) {
    let pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return pattern.test(ipAddress);
}

