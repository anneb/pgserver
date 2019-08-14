// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/bbox.js

const sqlTableName = require('./utils/sqltablename.js');


const sql = (params, query) => {
    return `
    SELECT 
      ST_Extent(ST_Transform(${query.geom_column}, ${query.srid})) as bbox
  
    FROM 
      ${sqlTableName(params.table)}
  
    -- Optional where filter
    ${query.filter ? `WHERE ${query.filter}` : '' }
    `
}

module.exports = function(app, pool) {
/**
 * @swagger
 *
 * /api/bbox/{table}:
 *   get:
 *     description: Gets the bounding box of a feature(s)
 *     tags: ['api']
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: name of postgis table
 *         in: path
 *         required: true
 *         type: string
 *       - name: geom_column
 *         description: name of geometry column (default 'geom')
 *         in: query
 *         required: false
 *       - name: strid
 *         description: 'The SRID for the returned centroid. The default is <em>4326</em> WGS84 Lat/Lng.'
 *         in: query
 *         required: false
 *         type: integer
 *       - name: filter
 *         type: string
 *         description: 'Optional filter parameters for a SQL WHERE statement.'
 *         in: query
 *         required: false
 *     responses:
 *       200:
 *         description: vector tile
 *       204:
 *         description: no data (empty tile)
 *       422:
 *         description: invalid datasource or columnname
 */
  app.get('/api/bbox/:table', async (req, res)=>{
      if (!req.query.geom_column) {
        req.query.geom_column = 'geom'; //default
      }
      if (!req.query.srid) {
        req.query.srid = 4326
      }
      const sqlString = sql(req.params, req.query);
      try {
        const result = await pool.query(sqlString);
        res.json(result.rows);
      } catch(err) {
        console.log(err);
        res.status(500).json({error: err});
      }
  })
}