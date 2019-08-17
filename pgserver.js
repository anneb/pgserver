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

const DirCache = require('./utils/dircache.js')
const cache = new DirCache(`./cache/${dbconfig.database?dbconfig.database:process.env.PGDATABASE?process.env.PGDATABASE:''}`);


const swagger = require('./swagger.js')(app);
const login = require('./login.js')(app);
const upload = require('./upload.js')(app);
const mvt = require('./mvt.js')(app, readOnlyPool, cache);
const geojson = require('./geojson.js')(app, readOnlyPool);
const geobuf = require('./geobuf.js')(app, readOnlyPool);
const listLayers = require('./list_layers.js')(app, readOnlyPool);
const layerColumns = require('./layer_columns.js')(app, readOnlyPool);
const bbox = require('./bbox.js')(app, readOnlyPool, cache);
const query = require('./query.js')(app, readOnlyPool);
const columnStats = require('./column_stats.js')(app, readOnlyPool, cache);

const server = app.listen(pgserverconfig.port);
server.setTimeout(600000);

console.log(`pgserver listening on port ${pgserverconfig.port}`);

module.exports = app;
