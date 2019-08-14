// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/geojson.js

const sqlTableName = require('./utils/sqltablename.js');

const sql = (params, query) => {
  let bounds = query.bounds ? query.bounds.split(',').map(Number) : null;
  bounds && bounds.length === 3 ? bounds = merc.bbox(bounds[1], bounds[2], bounds[0]) : null;
  
  return `
  SELECT 
    Row_to_json(fc) as geojson

  FROM (
    SELECT 
      'FeatureCollection' AS type, 
      COALESCE(Array_to_json(Array_agg(f)), '[]'::json) AS features

  FROM (
    SELECT 
      'Feature' AS type, 
      St_asgeojson(ST_Transform(lg.${query.geom_column}, 4326))::json AS geometry,
      ${query.columns ? ` 
      Row_to_json(
        (
          SELECT 
            l 
          FROM   
         (SELECT ${query.columns}) AS l
        )
      ) AS properties 
      ` : `'{}'::json AS properties`}
                
    FROM   
      ${sqlTableName(params.table)} AS lg
      ${bounds ? `, (SELECT ST_SRID(${query.geom_column}) as srid FROM ${sqlTableName(params.table)} LIMIT 1) sq` : ''}
      
    
    -- Optional Filter
    ${query.filter || bounds ? 'WHERE' : ''}
    ${query.filter ? `${query.filter}` : '' }
    ${query.filter && bounds ? 'AND' : ''}
    ${bounds ? `      
      ${query.geom_column} &&
      ST_Transform(
        ST_MakeEnvelope(${bounds.join()}, 4326), 
        srid
      )      
    ` : ''}

    ) AS f
  ) AS fc; 
  `
}

module.exports = function(app, pool) {
/**
 * @swagger
 *
 * /data/geojson/{table}:
 *   get:
 *     description: return table as geojson
 *     tags: ['geodata']
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: name of table or view
 *         in: path
 *         required: true
 *         type: string
 *       - name: geom_column
 *         description: name of geometry column (default 'geom')
 *         in: query
 *         required: false
 *       - name: columns
 *         description: optional comma seperated list of attribute columns to be added to the mvt geometries
 *         in: query
 *         required: false
 *         type: string
 *       - name: filter
 *         description: 'Optional filter parameters for a SQL WHERE statement.'
 *         in: query
 *         type: string
 *         required: false
 *       - name: bounds
 *         description: 'Optionally limit output to features that intersect bounding box. Can be expressed as a bounding box (sw.lng, sw.lat, ne.lng, ne.lat) or a Z/X/Y tile (0,0,0).'
 *         in: query
 *         type: string
 *         pattern: '^-?[0-9]{0,20}.?[0-9]{1,20}?(,-?[0-9]{0,20}.?[0-9]{1,20}?){2,3}$'
 *     responses:
 *       200:
 *         description: geojson
 *       422:
 *         description: invalid datasource or columnname
 */
  app.get('/data/geojson/:table', async (req, res) => {
      if (!req.query.geom_column) {
        req.query.geom_column = 'geom';
      }
      const sqlString = sql(req.params, req.query);
      try {
        const result = await pool.query(sqlString);
        res.json(result.rows[0].geojson)
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