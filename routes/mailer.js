const express = require('express');
const router = express.Router();
const path = require('path');
const user = require('../models/user.js');
const jwt = require('jsonwebtoken');
const util = require('util');
const AWS = require('aws-sdk');
const htmlToText = require('html-to-text');
const client = require('../cgi/client.js');
const mailbox = require('../models/mailbox.js');

AWS.config.update({
    region: "ca-central-1",
    endpoint: "https://dynamodb.ca-central-1.amazonaws.com"
});

const db = new AWS.DynamoDB.DocumentClient();

router.get('/', (req, res) => {
    if (req.cookies) {
        if (req.cookies.uuid) {
            try {
                const bearerToken = req.cookies.uuid;
                let user = jwt.verify(bearerToken, process.env.AUTH_KEY);
                req.user = user;
                res.status(200).redirect('/mailer/mailbox');
            } catch (error) {
                res.status(200).render('sign-in', {
                    signIn_error: false,
                    signUp_error: false
                });
            }
        } else{
            res.status(200).render('sign-in', {
                signIn_error: false,
                signUp_error: false
            });  
        }
    } else {
        res.status(200).render('sign-in', {
            signIn_error: false,
            signUp_error: false
        });
    }
});

router.post('/', (req, res) => {
    if (req.body) {
        if (req.body.username && req.body.pass) {
            if (validateUsername(req.body.username)) {
                user.authenticate(req.body.username.toString().toLowerCase(), req.body.pass, function(err, user) {
                    if (err) {
                        res.status(404).render('sign-in', {
                            signIn_error: 'You have entered Incorrect credentials.',
                            signUp_error: false
                        });
                    } else {
                        console.log(`\nStarting session for ${user.username}...`);
                        const browserToken = getToken(user);
                        console.log('\nSession started.\n');
                        res.cookie('uuid', browserToken, {secure: true, maxAge: 86400000, httpOnly: true });
                        res.status(200).redirect('/mailer/mailbox');
                    }
                });
            } else {
                res.status(404).render('sign-in', {
                    signIn_error: 'Username field is not valid.',
                    signUp_error: false
                });
            }
        } else {
            res.status(404).render('sign-in', {
                signIn_error: 'All fields are required.',
                signUp_error: false
            });
        }
    } else {
        res.status(404).render('sign-in', {
            signIn_error: 'All fields are required.', 
            signUp_error: false
        });
    }
});

router.get('/sign-up', async(req, res) => {
    res.redirect('/mailer');
});

router.post('/sign-up', async(req, res) => {
    if (req.body) {
        let { fname, lname, username, email, pass, pass2, domain } = req.body;

        if (fname != '' && lname != '' && username != '' && email != '' && pass != '' && pass2 != '' && domain != '') {
            if (pass != pass2) {
                res.status(400).render('sign-in', {
                    signIn_error: false,
                    signUp_error: 'Passwords do not match.'
                });
            } else {
                if (validatePassword(pass)) {
                    if (isURL(domain)) {
                        if(validateName(fname) && validateName(lname)){
                            if(validateUsername(username)){
                                if(validateEmail(email)){
                                    username = username.toString().toLowerCase();
                                    let registeredUser = await user.fetch(username);
                                    console.log('DB response: ' + registeredUser);
                                    if(registeredUser.username){
                                        if(registeredUser.username === username){
                                            res.status(400).render('sign-in', {
                                                signIn_error: false,
                                                signUp_error: 'Username is already taken.'
                                            });
                                        }  
                                    }
                                    else{
                                        console.log(`\nWelcome ${username} to Sproft Mail `);
                                        console.log('\nAdding user to database...');
                                        user.add(email, username, fname, lname, domain, pass, function(err, user) {
                                            if (err) {
                                                console.log(err);
                                                res.status(500).render('sign-in', {
                                                    signIn_error: false,
                                                    signUp_error: 'Internal Server ERROR'
                                                });
                                            } else {
                                                console.log('\nUser Added.');
                                                console.log(`\nRetrieving token for `, util.inspect(user));
                                                const browserToken = getToken(user);
                                                console.log('\nSuccess!');
                                                res.cookie('uuid', browserToken, { secure: true, maxAge: 86400000, httpOnly: true });
                                                res.status(200).redirect('/mailer/mailbox');
                                            }
                                        });
                                    }
                                }
                                else{
                                    res.status(400).render('sign-in', {
                                        signIn_error: false,
                                        signUp_error: 'Email field is not valid.'
                                    });   
                                }
                            }
                            else{
                                res.status(400).render('sign-in', {
                                    signIn_error: false,
                                    signUp_error: 'Username can only contain letters and numbers'
                                });    
                            }
                        }
                        else{
                            res.status(400).render('sign-in', {
                                signIn_error: false,
                                signUp_error: 'Name fields are not valid.<br>Must only contain alphanumeric characters.'
                            });  
                        }
                    } else {
                        res.status(400).render('sign-in', {
                            signIn_error: false,
                            signUp_error: 'Domain name is not a valid URL'
                        });
                    }
                } else {
                    res.status(400).render('sign-in', {
                        signIn_error: false,
                        signUp_error: 'Password must be between 4-8 characters'
                    });
                }
            }
        } else {
            res.status(404).render('sign-in', {
                signIn_error: false,
                signUp_error: 'All fields are required.'
            });
        }
    } else {
        res.status(404).render('sign-in', {
            signIn_error: false,
            signUp_error: 'All fields are required.'
        });
    }
});

router.get('/mailbox', verifyToken, async(req, res) => {
        if (req.user) {
            let mode = 1;
            let templateMode = 'i';
            let title = 'Inbox';
            if(req.query.q){
                mode = Number(req.query.q);

                if(!validateNumber(mode)){
                    return res.status(400).redirect('/mailer'); 
                }

                if(mode > 5){
                    return res.status(400).redirect('/mailer');
                }

                switch(mode){
                    case 1:
                        title = 'Inbox';
                        templateMode = 'i';
                        break;
                    case 2:
                        title = 'Sent items';
                        templateMode = 's';
                        break;
                    case 3:
                        title = 'Drafts';
                        templateMode = 'd';
                        break;
                    case 4:
                        title = 'Trash';
                        templateMode = 't';
                        break;
                    case 5:
                        title = 'Spam';
                        templateMode = 'sp';
                        break;
                }
            }
            let inbox = await mailbox.retrieve(req.user, mode);
            console.log('\nMailbox found.');
            if(inbox){
                let mailbox = inbox.mailbox;
                if(mailbox.length > 0){
                    let mailCount = [];
                    for(var i=0; i<mailbox.length; i++){
                        mailCount.push(i);
                    }
                    res.status(200).render('mailbox', {
                        title: title,
                        user: req.user,
                        mailbox: mailbox,
                        newMail: inbox.newMail,
                        mailCount: mailCount,
                        mode: templateMode
                    });
                }
                else{
                    res.status(200).render('mailbox', {
                        title: title,
                        user: req.user,
                        mailbox: [],
                        newMail: inbox.newMail,
                        mailCount: [],
                        mode: templateMode 
                    }); 
                }
            }
            else{
                res.status(400).render('mailbox', {
                    error: 'Could not retrieve inbox'
                });
            }
        } else {
            console.log('\nERROR: User not found.')
            res.status(200).redirect('/mailer');
        }
});

router.get('/sign-out', verifyToken, async (req, res)=>{
    res.clearCookie('uuid', {secure: true, httpOnly: true });
    res.status(200).redirect('/mailer');
    await user.cleanUp(req.user);
});

router.get('/compose', verifyToken, async (req, res)=>{
    let inbox = await mailbox.retrieve(req.user, 1);
    res.status(200).render('compose', {
        title: 'Compose New Message',
        user: req.user,
        newMail: inbox.newMail
    });
});

router.post('/compose', verifyToken, async (req, res)=>{
    console.log('\nPreparing to send mail\n');
    if(req.body){
        req.body.body_text = htmlToText.fromString(req.body.body_html, {
            tables: true,
            linkHrefBaseUrl: 'https://sproft.com',
            ignoreImage: true,
            preserveNewlines: true
        });
        let date = new Date();
            let email = req.body;
            let messageConfig = {
                from: `${req.user.username}@sproft.com`,
                to: email.to,
                cc: email.cc,
                subject: email.subject,
                replyTo: `${req.user.username}@sproft.com`,
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
        
        if(req.body.send != undefined){
            delete req.body.send
            await client.sendmail(req.user, req.body);
            //update sent items
            res.status(200).redirect('/mailer');
        }
        else if(req.body.draft !=undefined){
            delete req.body.draft;
            let data = {
                mode: 3,
                message: messageConfig
            }
            await mailbox.add(req.user, data);
            res.status(200).redirect('/mailer/mailbox/?q=3');
        }
        else if(req.body.discard !=undefined){
            delete req.body.discard;
            let data = {
                mode: 4,
                message: messageConfig
            }
            await mailbox.add(req.user, data);
            res.status(200).redirect('/mailer/mailbox/?q=4');
        }
        else{
            res.status(200).redirect('/mailer');
        }
    }
    else{
        res.status(200).redirect('/mailer');
    }
});

router.get('/mailbox/mail', verifyToken, async (req, res)=>{
    if(req.query){
        let mode, index;
        if(req.query.i){
            if(validateNumber(Number(req.query.i))){
                index = Number(req.query.i);
                mode = 1;
            }
        } 
        else if(req.query.s){
            if(validateNumber(Number(req.query.s))){
                index = Number(req.query.s);
                mode = 2;
            }
        }
        else if(req.query.d){
            if(validateNumber(Number(req.query.d))){
                index = Number(req.query.d);
                mode = 3;
            }
        }
        else if(req.query.t){
            if(validateNumber(Number(req.query.t))){
                index = Number(req.query.t);
                mode = 4;
            }
        }
        else if(req.query.sp){
            if(validateNumber(Number(req.query.sp))){
                index = Number(req.query.sp);
                mode = 5;
            }
        }
        else{
            return res.status(400).redirect('/mailer');
        }
            let mail = await mailbox.getMail(req.user, mode, index.toString());
            res.status(200).render('read-mail', {
                user: req.user,
                title: 'Read Message',
                mail: mail.message,
                newMail: mail.newMail
            });
            
    }   
    else{
        res.status(400).redirect('/mailer/mailbox');
    }
});

function validateEmail(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validateName(name){
    var re = /^[a-zA-Z\-]+$/;
    return re.test(name);
}

function validateUsername(username){
    var re = /^[a-zA-Z0-9]+$/;
    return re.test(username);
}

function validatePassword(pass) {
    return pass.length >= 4 ? true : false;
}
function validateNumber(number){
    var re = /^\d+$/;
    return re.test(number);
}

function verifyToken(req, res, next) {
    if (req.cookies) {
        if (req.cookies.uuid) {
            const bearerToken = req.cookies.uuid;
            let user = jwt.verify(bearerToken, process.env.AUTH_KEY);
            req.user = user;
            next();
            return;
        } else {
            return res.status(400).redirect('/mailer');
        }
    }
    else{
        return res.status(400).redirect('/mailer'); 
    }
}

function isURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return pattern.test(str);
}

function getToken(user) {
    return jwt.sign(user, process.env.AUTH_KEY, { expiresIn: '24h' });
}
module.exports = router;