const pgserverconfig = require('./config/pgserver.json')

const express = require('express');
const logger = require('morgan');
const cors = require('cors');

const app = express();

app.use(logger('dev'));
app.use(cors());
app.use('/', express.static(__dirname + '/public'));

let adminApp;
if (pgserverconfig.userport === pgserverconfig.adminport) {
    adminApp = app;
} else {
    if (pgserverconfig.adminport > 0) {
        adminApp = express();
        adminApp.use(logger('dev'));
        adminApp.use(cors());
    }
}
if (adminApp) {
    adminApp.use('/admin', express.static(__dirname + '/admin'));
}


const dbconfig = require('./config/dbconfig.json');
const pgp = require('pg-promise')({
    /*query: (e) => {
        console.log(e.query);
    }*/
});
const readOnlyPool = pgp(dbconfig);
let adminPool;
if (adminApp) {
    if (dbconfig.adminuser && dbconfig.user !== dbconfig.adminuser) {
        dbconfig.user = dbconfig.adminuser;
        dbconfig.password = dbconfig.adminpassword;
        adminPool = pgp(dbconfig);
    } else {
        adminPool = readOnlyPool;
    }
}

const DirCache = require('./utils/dircache.js')
const cache = new DirCache(`./cache/${dbconfig.database?dbconfig.database:process.env.PGDATABASE?process.env.PGDATABASE:''}`);


const swagger = require('./swagger.js')(app);
const login = require('./login.js')(app);
const upload = require('./upload.js')(adminApp);
const mvt = require('./mvt.js')(app, readOnlyPool, cache);
const geojson = require('./geojson.js')(app, readOnlyPool);
const geobuf = require('./geobuf.js')(app, readOnlyPool);
const listLayers = require('./list_layers.js')(app, readOnlyPool);
const layerColumns = require('./layer_columns.js')(app, readOnlyPool);
const bbox = require('./bbox.js')(app, readOnlyPool, cache);
const query = require('./query.js')(app, readOnlyPool);
const columnStats = require('./column_stats.js')(app, readOnlyPool, cache);

const server = app.listen(pgserverconfig.userport);
server.setTimeout(600000);
console.log(`pgserver listening on port ${pgserverconfig.userport}`);

if (adminApp && adminApp !== app) {
    const adminServer = adminApp.listen(pgserverconfig.adminport);
    adminServer.setTimeout(600000);
}
if (adminApp) {
    console.log(`pgserver admin listening on port ${pgserverconfig.adminport}`)
}

module.exports = app;
