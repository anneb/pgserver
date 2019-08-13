const sm = require('@mapbox/sphericalmercator');
const fs = require('fs');
const merc = new sm({
  size: 256
})

// route query
const sql = (params, query) => {
    let bounds = merc.bbox(params.x, params.y, params.z, false, '900913')
  
    return `
    SELECT 
      ST_AsMVT(q, '${params.table}', 4096, 'geom')
    
    FROM (
      SELECT
        ${query.columns ? `${query.columns},` : ''}
        ST_AsMVTGeom(
          ST_Transform(${query.geom_column}, 3857),
          ST_MakeBox2D(ST_Point(${bounds[0]}, ${bounds[1]}), ST_Point(${
      bounds[2]
    }, ${bounds[3]}))
        ) geom
  
      FROM (
        SELECT
          ${query.columns ? `${query.columns},` : ''}
          ${query.geom_column},
          srid
        FROM 
          ${params.table},
          (SELECT ST_SRID(${query.geom_column}) AS srid FROM ${
      params.table
    } LIMIT 1) a
          
        WHERE       
          ST_transform(
            ST_MakeEnvelope(${bounds.join()}, 3857), 
            srid
          ) && 
          ${query.geom_column}
  
          -- Optional Filter
          ${query.filter ? `AND ${query.filter}` : ''}
      ) r
  
    ) q
    `
  } // TODO, use sql place holders $1, $2 etc. instead of inserting user-parameters into query
  

// TODO add flat-cache

module.exports = function(app, pool) {
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
 *     responses:
 *       200:
 *         description: vector tile
 *       204:
 *         description: no data (empty tile)
 *       422:
 *         description: invalid datasource or columnname
 */
    app.get('/data/:datasource/mvt/:z/:x/:y', async (req, res)=>{
        if (!req.query.geom_column) {
            req.query.geom_column = 'geom'; // default
        }
        req.params.table = req.params.datasource;
        const sqlString = sql(req.params, req.query);
        //console.log(sqlString);
        try {
            const result = await pool.query(sqlString);
            const mvt = result.rows[0].st_asmvt
            if (mvt.length === 0) {
                res.status(204)
            }
            res.header('Content-Type', 'application/x-protobuf').send(mvt);
        } catch(err) {
            console.log(err);
            switch (err.code) {
                case '42P01':
                    err.name = `table ${req.params.table} does not exist`;
                    break;
                case '42703':
                    err.name = `column does not exist`;
                    break;
            }
            res.status(422).json({error:err})
        }
    })
}