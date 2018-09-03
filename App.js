require('./setEnv');
require('ejs');
require('./smtp_server/server');
require('./smtp_server/server2');
require('./smtp_server/server3');
require('./smtp_server/server4');
const express = require('express');
const app = express();
const index = require('./routes/index');
const mailer = require('./routes/mailer');
const payments = require('./routes/payments');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const fs = require('fs');
const https = require('https');

const certOptions = {
    cert: fs.readFileSync(__dirname + '/smtp_server/sproft_cert.pem'),
    key: fs.readFileSync(__dirname + '/smtp_server/sproft_private.pem')
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.static(path.join(__dirname, '/mailer/public')));
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/', index);
app.use('/mailer', mailer);
app.use('/payments', payments);
app.listen(process.env.PORT || 8081, () => {
    console.log('[' + new Date() + '] INFO: Sproft Media Web Server is listening on [::]:' + process.env.PORT);
});
https.createServer(certOptions, app).listen(443);