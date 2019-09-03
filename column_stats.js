const sqlTableName = require('./utils/sqltablename.js');

// get top 100 most frequent values and null values
const sql = (params, query) => {
    return `
      with sortedrecords as 
      (select count(1)::integer as "count", "${params.column}" as "value"
            from ${sqlTableName(params.table)} 
              where ${query.geom_column} is not null 
                group by "${params.column}" order by count(1) desc)
    ,toprecords as
      (select * from sortedrecords limit 100)
    ,resultset as
      (select * from toprecords
        union
      select * from sortedrecords where value is null)
    select distinct * from resultset order by count desc;`
  } // TODO, use sql place holders $1, $2 etc. instead of inserting user-parameters into query

// https://leafo.net/guides/postgresql-calculating-percentile.html
const sqlPercentiles = (params, query) => {
  return `
  select min(buckets.value) "from", max(buckets.value) "to", count(ntile)::integer "count", ntile as percentile
    from
      (select "${params.column}" as value, ntile(100) over (order by "${params.column}") 
        from ${sqlTableName(params.table)} 
          where "${params.column}" is not null and ${query.geom_column} is not null) 
      as buckets
    group by ntile order by ntile;
  `
}

const sqlPercentilesVarchar = (params, query) => {
  return `
  select min(buckets.value) "from", max(buckets.value) "to", count(ntile)::integer "count", ntile as percentile
    from
      (select "${params.column}" as value, ntile(100) over (order by "${params.column}" collate "C.UTF-8") 
        from ${sqlTableName(params.table)} 
          where "${params.column}" is not null and ${query.geom_column} is not null) 
      as buckets
    group by ntile order by ntile;
  `
}


const sqlPercentilesBoolean = (params, query) => {
  return `
  select case when min(buckets.value) = 0 then false else true end "from", case when max(buckets.value) = 0 then false else true end "to", count(ntile)::integer "count", ntile as percentile
    from
      (select "${params.column}"::integer as value, ntile(100) over (order by "${params.column}") 
        from ${sqlTableName(params.table)} 
          where "${params.column}" is not null and ${query.geom_column} is not null) 
      as buckets
    group by ntile order by ntile;
  `
}

let typeMap = null;
async function getTypeName(id, pool) {
  if (!typeMap) {
    const sql = "select oid,typname from pg_type  where oid < 1000000 order by oid";
    try {
      const queryResult = await pool.query(sql);
      typeMap = new Map(queryResult.map(row=>[row.oid, row.typname]));
    } catch(err) {
      console.log(`error loading types: ${err}`);
      return id.toString();
    }
  }
  const result = typeMap.get(id);
  if (!result) {
    return id.toString();
  }
  return result;
}

module.exports = function(app, pool, cache) {

  let cacheMiddleWare = async(req, res, next) => {
    if (!cache) {
      next();
      return;
    }
    const cacheDir = `${req.params.table}/colstats/`;
    const key = ((req.query.geom_column?req.query.geom_column:'geom') + (req.params.column?','+req.params.column:''))
      .replace(/[\W]+/g, '_');
  
    const stats = await cache.getCachedFile(cacheDir, key);
    if (stats) {
      console.log(`stats cache hit for ${cacheDir}?${key}`);
      if (stats.length === 0) {
        res.status(204)
      }
      res.header('Content-Type', 'application/json').send(stats);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.setCachedFile(cacheDir, key, body);
        }
        res.sendResponse(body);
      }
      next();
    }
  }
  
 /**
 * @swagger
 *
 * /data/{table}/colstats/{column}:
 *   get:
 *     description: get statistics for column
 *     tags: ['meta']
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: name of postgis table
 *         in: path
 *         required: true
 *         type: string
 *       - name: column
 *         description: name of column
 *         in: path
 *         type: string
 *         required: true
 *       - name: geom_column
 *         description: name of geometry column (default 'geom')
 *         in: query
 *         required: false
 *     responses:
 *       200:
 *         description: json statistics
 *         content:
 *            application/json
 *         schema:
 *              type: object
 *              properties:
 *                table:
 *                   type: string
 *                   description: name of table
 *                column:
 *                  type: string
 *                  description: name of column
 *                numvalues:
 *                  description: number of different values, null means unknown (>2000)
 *                  type: integer
 *                uniquevalues:
 *                  description: whether or not all values are unique
 *                  type: boolean
 *                values:
 *                  description: array of values sorted by highest count first
 *                  type: array
 *                  maxItems: 2000
 *                  items:
 *                    type: object
 *                    properties:
 *                      value:
 *                        description: encountered value for column (any type)
 *                        type: string
 *                      count: 
 *                        description: number of geometries with this value
 *                        type: integer
 *       204:
 *         description: no data 
 *       422:
 *         description: invalid table or column
 *       500:
 *         description: unexpected error
 */
    app.get('/data/:table/colstats/:column', cacheMiddleWare, async (req, res)=>{
        if (!req.query.geom_column) {
            req.query.geom_column = 'geom'; // default
        }
        let sqlString = sql(req.params, req.query);
        //console.log(sqlString);
        try {
            let queryResult = await pool.result(sqlString);
            let datatype = await getTypeName(queryResult.fields[1].dataTypeID, pool);
            if (datatype === "numeric" || datatype === "int8") {
              // numeric datatype, try to convert to Number
              try {
                queryResult.rows = queryResult.rows.map(row=>{row.value=row.value?Number(row.value):row.value; return row});
              } catch(err) {
                // failed Numeric conversion
              }
            }
            let stats = queryResult.rows;
            let result = {
              table: req.params.table,
              column: req.params.column,
              datatype: datatype,
              numvalues: stats.length < 2000?stats.length:null,
              uniquevalues: stats.length?stats[0].value !== null?stats[0].count === 1:stats.length>1?stats[1].count === 1:false:[],
              values: stats
            }
            if (stats.length === 0) {
              result.percentiles = [];
              res.json(result);
              return;
            }
            if (datatype === "bool") {
              sqlString = sqlPercentilesBoolean(req.params, req.query);
            } else if (datatype === "varchar") {
              sqlString = sqlPercentilesVarchar(req.params, req.query);
            } else {
              sqlString = sqlPercentiles(req.params, req.query);
            }
            queryResult = await pool.query(sqlString);
            if (datatype === "numeric" || datatype === "int8") {
              // numeric datatype, try to convert to Number
              try {
                queryResult = queryResult.map(row=>{row.from=Number(row.from); row.to=Number(row.to); return row});
              } catch(err) {
                // failed Numeric conversion
              }
            }
            result.percentiles = queryResult;
            res.json(result);
        } catch(err) {
            console.log(err);
            let status = 500;
            switch (err.code) {
              case '42P01':
                // table does not exist
                status = 422;
                break;
              case '42703':
                // column does not exist
                status = 422;
                break;
              default:
            }
            res.status(status).json({error:err.message})
        }
    })
}