// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/bbox.js

const sqlTableName = require('./utils/sqltablename.js');
const DirCache = require('./utils/dircache.js')
const cache = new DirCache('./cache');


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

let cacheMiddleware = async(req, res, next) => {
  const cacheDir = `${req.params.table}/bbox`
  const key = ((req.query.geom_column?req.query.geom_column:'geom') 
    + (req.query.columns?'_'+req.query.columns:'')
    + (req.query.filter?'_'+req.query.filter:''))
    .replace(/[\W]+/g, '_');

  const bbox = await cache.getCachedFile(cacheDir, key);
  if (bbox) {
    console.log(`bbox cache hit for ${cacheDir}?${key}`);
    res.header('Content-Type', 'application/json').send(bbox);
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
 *       - name: filter
 *         type: string
 *         description: 'Optional filter parameters for a SQL WHERE statement.'
 *         in: query
 *         required: false
 *     responses:
 *       200:
 *         description: boundingboxes and row counters
 *         content:
 *            application/json
 *         schema:
 *            type: object
 *            properties:
 *               allrows:
 *                 type: integer
 *                 description: number of rows in table
 *               geomrows:
 *                  type: integer
 *                  description: number of non-null geometries in table
 *               bboxll:
 *                  description: boundingbox of geometries defined in latitude and longitude
 *                  type: array
 *                  minItems: 2
 *                  maxItems: 2
 *                  items:
 *                     type: array
 *                     minItems: 2
 *                     maxItems: 2
 *                     items: 
 *                       type: number
 *               srid:
 *                   type: integer
 *                   description: id of spatial reference system (EPSG code) used by geometries
 *               bboxsrid:
 *                  description: boundingbox of geometries defined using geometry srid 
 *                  type: array
 *                  minItems: 2
 *                  maxItems: 2
 *                  items:
 *                     type: array
 *                     minItems: 2
 *                     maxItems: 2
 *                     items: 
 *                       type: number
 *       422:
 *         description: invalid datasource or columnname
 */
  app.get('/api/bbox/:table', cacheMiddleware, async (req, res)=>{
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