const sqlTableName = require('./utils/sqltablename.js');

const sql = (params, query) => {
    return `
      select count(1)::integer as "count", ${params.column} as "value"
        from ${params.table} 
          where ${query.geom_column} is not null 
            group by ${params.column} order by count(1) desc limit 2000;
    `
  } // TODO, use sql place holders $1, $2 etc. instead of inserting user-parameters into query

module.exports = function(app, pool, cache) {

  let cacheMiddleWare = async(req, res, next) => {
    if (!cache) {
      next();
      return;
    }
    const cacheDir = `${req.params.table}/attrstats/`;
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
        const sqlString = sql(req.params, req.query);
        //console.log(sqlString);
        try {
            const result = await pool.query(sqlString);
            const stats = result.rows
            if (stats.length === 0) {
                res.status(204).json({});
                return;
            }
            res.json({
              table: req.params.table,
              column: req.params.column,
              numvalues: stats.length < 2000?stats.length:null,
              uniquevalues: stats[0].value !== null?stats[0].count === 1:stats.length>1?stats[1].count === 1:false,
              values: stats
            })
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