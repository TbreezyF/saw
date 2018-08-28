require('ejs');
require('dotenv').config();
require('./smtp_server/server');
const express = require('express');
const app = express();
const index = require('./routes/index');
const path = require('path');
const mailer = require('./routes/mailer');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.static(path.join(__dirname, '/mailer/public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/', index);
app.use('/mailer', mailer);
app.listen(process.env.PORT || 8081, () => {
    console.log('[' + new Date() + '] INFO: Sproft Media Web Server is listening on [::]:' + process.env.PORT);
});