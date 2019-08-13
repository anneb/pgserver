// based on https://raw.githubusercontent.com/tobinbradley/dirt-simple-postgis-http-api/master/routes/list_layers.js


const sql = () => {
    return `
    SELECT current_database()::character varying(256) AS f_table_catalog,
      n.nspname AS f_table_schema,
      c.relname AS f_table_name,
      a.attname AS f_geometry_column,
      COALESCE(postgis_typmod_dims(a.atttypmod), sn.ndims, 2) AS coord_dimension,
      COALESCE(NULLIF(postgis_typmod_srid(a.atttypmod), 0), sr.srid, 0) AS srid,
      replace(replace(COALESCE(NULLIF(upper(postgis_typmod_type(a.atttypmod)), 'GEOMETRY'::text), st.type, 'GEOMETRY'::text), 'ZM'::text, ''::text), 'Z'::text, ''::text)::character varying(30) AS type,
      ((c.reltuples/case when c.relpages=0 then 1 else c.relpages end) * (pg_relation_size(c.oid) / (current_setting('block_size')::integer)))::bigint as estimated_rows
     FROM pg_class c
       JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
       JOIN pg_namespace n ON c.relnamespace = n.oid
       JOIN pg_type t ON a.atttypid = t.oid
       LEFT JOIN ( SELECT s.connamespace,
              s.conrelid,
              s.conkey,
              replace(split_part(s.consrc, ''''::text, 2), ')'::text, ''::text) AS type
             FROM pg_constraint s
            WHERE s.consrc ~~* '%geometrytype(% = %'::text) st ON st.connamespace = n.oid AND st.conrelid = c.oid AND (a.attnum = ANY (st.conkey))
       LEFT JOIN ( SELECT s.connamespace,
              s.conrelid,
              s.conkey,
              replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text)::integer AS ndims
             FROM pg_constraint s
            WHERE s.consrc ~~* '%ndims(% = %'::text) sn ON sn.connamespace = n.oid AND sn.conrelid = c.oid AND (a.attnum = ANY (sn.conkey))
       LEFT JOIN ( SELECT s.connamespace,
              s.conrelid,
              s.conkey,
              replace(replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text), '('::text, ''::text)::integer AS srid
             FROM pg_constraint s
            WHERE s.consrc ~~* '%srid(% = %'::text) sr ON sr.connamespace = n.oid AND sr.conrelid = c.oid AND (a.attnum = ANY (sr.conkey))
    WHERE (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT c.relname = 'raster_columns'::name AND t.typname = 'geometry'::name AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text);
    `;
  }



  module.exports = function(app, pool) {
 /**
 * @swagger
 *
 * /data/list_layers:
 *   get:
 *     description: get list of available tables
 *     tags: ['meta']
 *     summary: 'list PostGIS layers'
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: list of layers
 */
      app.get('/data/list_layers', async (req, res)=>{
        try {
            const sqlString = sql()
            const result = await pool.query(sqlString);
            const layers = result.rows
            res.json(layers)
        } catch(err) {
            res.json({error: err})
        }
      })
  }