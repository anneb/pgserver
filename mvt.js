// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/mvt.js
const sqlTableName = require('./utils/sqltablename.js');

const sm = require('@mapbox/sphericalmercator');
const merc = new sm({
  size: 256
})

function toBoolean(value) {
  if (!value) {
    return false;
  }
  if (typeof value === 'string'){
    if (value.trim() === '') {
      return false;
    } else if (Number(value) === NaN) {
      switch (value.toLowerCase().trim()) {
        case 'no':
        case 'false':
        case 'n':
        case 'f':
          return false;
        default:
          return true;
      }
    } else {
      return Number(value) !== 0;
    }
  }
  if (Number(value)!== NaN) {
    return Number(value) !== 0;
  }
  return true;
}

function queryColumnsNotNull(query) {
  const queryColumns = query.columns;
  const includeNulls = toBoolean(query.include_nulls);
  
  if (!includeNulls && queryColumns) {
    return ` and (${queryColumns.split(',').map(column=>`${column} is not null`).join(' or ')})`
  } 
  return ''
}

const sql = (params, query) => {
    let bounds = merc.bbox(params.x, params.y, params.z, false, '900913')
  
    return `
    SELECT ST_AsMVT(q, '${params.table}', 4096, 'geom')
    FROM 
      (SELECT  ${query.columns ? `${query.columns},` : ''}
        ST_AsMVTGeom(
          ST_Transform(${query.geom_column}, 3857),
          ST_MakeBox2D(ST_Point(${bounds[0]}, ${bounds[1]}), ST_Point(${bounds[2]}, ${bounds[3]}))
        ) geom
      FROM 
        (SELECT ${query.columns ? `${query.columns},` : ''} ${query.geom_column}, srid
          FROM 
            ${sqlTableName(params.table)},
            (SELECT ST_SRID(${query.geom_column}) AS srid FROM ${sqlTableName(params.table)} 
              WHERE ${query.geom_column} is not null  LIMIT 1) a    
          WHERE
            ${query.geom_column} is not null AND
            ST_transform(
              ST_MakeEnvelope(${bounds.join()}, 3857), 
              srid
            ) && ${query.geom_column}
            ${queryColumnsNotNull(query)}
          -- Optional Filter
          ${query.filter ? `AND ${query.filter}` : ''}
      ) r
    ) q
    `
  } // TODO, use sql place holders $1, $2 etc. instead of inserting user-parameters into query

module.exports = function(app, pool, cache) {

  let cacheMiddleWare = async(req, res, next) => {
    if (!cache) {
      next();
      return;
    }
    const cacheDir = `${req.params.datasource}/mvt/${req.params.z}/${req.params.x}/${req.params.y}`;
    const key = ((req.query.geom_column?req.query.geom_column:'geom') + (req.query.columns?','+req.query.columns:'')) + (toBoolean(req.query.include_nulls)?'_includenulls':'')
      .replace(/[\W]+/g, '_');
  
    const mvt = await cache.getCachedFile(cacheDir, key);
    if (mvt) {
      console.log(`cache hit for ${cacheDir}?${key}`);
      if (mvt.length === 0) {
        res.status(204)
      }
      res.header('Content-Type', 'application/x-protobuf').send(mvt);
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
 * /data/{datasource}/mvt/{z}/{x}/{y}:
 *   get:
 *     description: get mapbox vector tile (mvt)
 *     tags: ['geodata']
 *     produces:
 *       - application/x-protobuf
 *     parameters:
 *       - name: datasource
 *         description: name of postgis datasource 
 *         in: path
 *         required: true
 *         type: string
 *       - name: z
 *         description: zoom level of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: x
 *         description: x value (column number) of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: y
 *         description: y value (row number) of tile
 *         in: path
 *         required: true
 *         type: number
 *       - name: geom_column
 *         description: name of geometry column (default 'geom')
 *         in: query
 *         required: false
 *       - name: columns
 *         description: optional comma seperated list of attribute columns to be added to the mvt geometries
 *         in: query
 *         required: false
 *         type: string
 *       - name: include_nulls
 *         description: 'optional parameter to include geometries where all attribute columns are null (default: false)'
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: vector tile
 *       204:
 *         description: no data (empty tile)
 *       422:
 *         description: invalid datasource or columnname
 */
    app.get('/data/:datasource/mvt/:z/:x/:y', cacheMiddleWare, async (req, res)=>{
        if (!req.query.geom_column) {
            req.query.geom_column = 'geom'; // default
        }
        req.params.table = req.params.datasource;
        const sqlString = sql(req.params, req.query);
        // console.log(sqlString);
        try {
            const result = await pool.query(sqlString);
            const mvt = result.rows[0].st_asmvt
            if (mvt.length === 0) {
                res.status(204)
            }
            res.header('Content-Type', 'application/x-protobuf').send(mvt);
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