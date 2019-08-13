// based on https://github.com/tobinbradley/dirt-simple-postgis-http-api/blob/master/routes/geobuf.js

// route query
const sql = (params, query) => {
    let bounds = query.bounds ? query.bounds.split(',').map(Number) : null
    bounds && bounds.length === 3
      ? (bounds = merc.bbox(bounds[1], bounds[2], bounds[0]))
      : null
  
    return `
  
    SELECT 
      ST_AsGeobuf(q, 'geom')
    
    FROM
    (
  
      SELECT
        ST_Transform(${query.geom_column}, 4326) as geom
        ${query.columns ? `, ${query.columns}` : ''}
  
      FROM
        ${params.table}
        ${
          bounds
            ? `, (SELECT ST_SRID(${query.geom_column}) as srid FROM ${
                params.table
              } LIMIT 1) sq`
            : ''
        }
  
      -- Optional Filter
      ${query.filter || bounds ? 'WHERE' : ''}
      ${query.filter ? `${query.filter}` : ''}
      ${query.filter && bounds ? 'AND' : ''}
      ${
        bounds
          ? `      
            ${query.geom_column} &&
            ST_Transform(
              ST_MakeEnvelope(${bounds.join()}, 4326), 
              srid
            )      
          `
          : ''
      }
  
    ) as q; 
  
    `
  }

  
  module.exports = function(app, pool) {
/**
 * @swagger
 *
 * /data/geobuf/{table}:
 *   get:
 *     description: return table as geobuf
 *     tags: ['geodata']
 *     produces:
 *       - application/x-protobuf
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
 *         description: geobuf data
 *       422:
 *         description: invalid datasource or columnname
 */
  app.get('/data/geobuf/:table', async (req, res)=> {
    if (!req.query.geom_column) {
        req.query.geom_column = 'geom';
      }
      const sqlString = sql(req.params, req.query);
      try {
        const result = await pool.query(sqlString);
        res.set('Content-Type', 'text/x-protobuf').send(result.rows[0].st_asgeobuf);
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