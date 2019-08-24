// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/bbox.js

const sqlTableName = require('./utils/sqltablename.js');

function splitTableName(params) {
  const parts = params.table.split('.');
  if (parts.length === 1) {
    return {
      namespace: 'public',
      tablename: parts[0]
    }
  } else {
    return {
      namespace: parts[0],
      tablename: parts[1]
    }
  }
}

const getSqlEstimateRows = (params) =>{
  const ts = splitTableName(params);
  return `select ((c.reltuples/case when c.relpages=0 then 1 else c.relpages end) * (pg_relation_size(c.oid) / (current_setting('block_size')::integer)))::integer as estimated_rows
     from pg_class c JOIN pg_namespace n on c.relnamespace = n.oid
       where n.nspname='${ts.namespace}' and c.relname='${ts.tablename}'
  `;
}

const sqlEstimateBbox = (params, query, estimatedRows) => {
  const ts = splitTableName(params);
  return `
    with srid as
      (select st_srid(${query.geom_column}) srid, geometrytype(${query.geom_column}) geomtype
         from ${sqlTableName(params.table)} 
            where ${query.geom_column} is not null limit 1)
    ,bboxsrid as
      (select ST_EstimatedExtent('${ts.namespace}', '${ts.tablename}', '${query.geom_column}') as bboxsrid)
    ,bboxll as
      (select st_extent(st_transform(st_setsrid(st_envelope(bboxsrid), srid),4326)) bboxll 
         from bboxsrid, srid)
    select ${estimatedRows} as allrows, ${estimatedRows} as geomrows,bboxll,srid,bboxsrid,geomtype 
       from bboxll,srid,bboxsrid      
  `;
} 

const sqlBbox = (params, query) => {
  return `
    with srid as 
      (select st_srid(${query.geom_column}) srid, geometrytype(${query.geom_column}) geomtype
        from ${sqlTableName(params.table)}
          where ${query.geom_column} is not null limit 1)
    ,bboxll as 
      (select ST_Extent(ST_Transform(${query.geom_column}, 4326)) as bboxll, count(*) allrows, count(${query.geom_column}) geomrows 
          from ${sqlTableName(params.table)}
            -- Optional where filter
            ${query.filter ? `WHERE ${query.filter}` : '' }
      )
    ,bboxsrid as
      (select st_extent(st_transform(st_setsrid(st_envelope(bboxll),4326),srid)) bboxsrid 
         from bboxll,srid)
    select allrows, geomrows, bboxll,srid,bboxsrid,geomtype
      from bboxll,srid,bboxsrid
  `;
}

module.exports = function(app, pool, cache) {
  let cacheMiddleware = async(req, res, next) => {
    if (!cache) {
      next();
      return;
    }
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
 *               estimated:
 *                 type: boolean
 *                 description: result is estimated (true) or precise (false)
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
      let sql = getSqlEstimateRows(req.params);
      let estimated = false;
      try {
        const estimateResult = await pool.query(sql);
        const estimatedRows = estimateResult[0].estimated_rows;
        if (estimatedRows < 5000000 || req.query.filter) {
          sql = sqlBbox(req.params, req.query);
        } else {
          sql = sqlEstimateBbox(req.params, req.query, estimatedRows);
          estimated = true;
        }
        const result = await pool.any(sql);
        if (result.length === 1) {
          const row = result[0];
          res.json({
            estimated: estimated,
            allrows: Number(row.allrows), 
            geomtype: row.geomtype,
            geomrows: Number(row.geomrows),
            srid: row.srid,
            bboxll: row.bboxll?row.bboxll.match(/BOX\((.*)\)/)[1].split(',').map(coord=>coord.split(' ').map(c=>parseFloat(c))):null,
            bboxsrid: row.bboxsrid?row.bboxsrid.match(/BOX\((.*)\)/)[1].split(',').map(coord=>coord.split(' ').map(c=>parseFloat(c))):null
          })
        } else if (result.length === 0) {
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