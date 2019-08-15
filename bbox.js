// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/bbox.js

const sqlTableName = require('./utils/sqltablename.js');


const sql = (params, query) => {
  return `
with srid as 
  (select st_srid(${query.geom_column}) srid from ${sqlTableName(params.table)} where ${query.geom_column} is not null limit 1)
,bboxll as 
(select ST_Extent(ST_Transform(${query.geom_column}, 4326)) as bboxll, count(*) allrows, count(${query.geom_column}) geomrows from ${sqlTableName(params.table)}
    -- Optional where filter
    ${query.filter ? `WHERE ${query.filter}` : '' }
)
,bboxsrid as
(select st_extent(st_transform(st_setsrid(st_envelope(bboxll),4326),srid)) bboxsrid from bboxll,srid)
select allrows, geomrows, bboxll,srid,bboxsrid from bboxll,srid,bboxsrid
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
        if (result.rows.length === 1) {
          const row = result.rows[0];
          res.json({
            allrows: Number(row.allrows), 
            geomrows: Number(row.geomrows),
            bboxll: row.bboxll?row.bboxll.match(/BOX\((.*)\)/)[1].split(',').map(coord=>coord.split(' ').map(c=>parseFloat(c))):null,
            srid: row.srid,
            bboxsrid: row.bboxsrid?row.bboxsrid.match(/BOX\((.*)\)/)[1].split(',').map(coord=>coord.split(' ').map(c=>parseFloat(c))):null
          })
        } else if (result.rows.length === 0) {
          res.json({
            allrows: 0,
            geomrows: 0,
            bboxll: null,
            srid: 0,
            bboxsrid: null
          })
        } else {
          throw(new Error('bbox query returned more than 1 row'));
        }
      } catch(err) {
        console.log(err);
        res.status(500).json({error: err.message});
      }
  })
}