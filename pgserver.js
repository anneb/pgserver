const pgserverconfig = require('./config/pgserver.json')

const express = require('express');
const logger = require('morgan');
const cors = require('cors');

const app = express();

const swagger = require('./swagger.js')(app);


app.use(logger('dev'));
app.use(cors());
app.use('/', express.static(__dirname + '/public'));

const login = require('./login.js')(app);
const upload = require('./upload.js')(app);
const mvt = require('./mvt.js')(app);

app.listen(pgserverconfig.port);
console.log(`pgserver listening on port ${pgserverconfig.port}`);

module.exports = app;
