const pgserverconfig = require('./config/pgserver.json')

const express = require('express');
const logger = require('morgan');
const cors = require('cors');

const app = express();

app.use(logger('dev'));
app.use(cors());
app.use('/', express.static(__dirname + '/public'));

const {Pool} = require('pg');
const dbconfig = require('./config/dbconfig.json');
const readOnlyPool = new Pool(dbconfig);
readOnlyPool.connect();

const swagger = require('./swagger.js')(app);
const login = require('./login.js')(app);
const upload = require('./upload.js')(app);
const mvt = require('./mvt.js')(app, readOnlyPool);
const geojson = require('./geojson.js')(app, readOnlyPool);
const list_layers = require('./list_layers')(app, readOnlyPool);
const bbox = require('./bbox.js')(app, readOnlyPool);

app.listen(pgserverconfig.port);
console.log(`pgserver listening on port ${pgserverconfig.port}`);

module.exports = app;
