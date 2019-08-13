const {Pool} = require('pg');

const dbconfig = require('./config/dbconfig.json');

const pool = new Pool(dbconfig);

pool.connect();



