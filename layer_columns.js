const sql = (params) => {
    return `
    SELECT 
      attname as field_name,
      typname as field_type
  
    FROM 
      pg_namespace, pg_attribute, pg_type, pg_class
  
    WHERE
      pg_type.oid = atttypid AND
      pg_class.oid = attrelid AND
      relnamespace = pg_namespace.oid AND
      attnum >= 1 AND
      relname = '${params.table}'
    `
}

module.exports = function (app, pool) {
/**
 * @swagger
 *
 * /data/layer_columns/:table:
 *   get:
 *     description: Returns a list of columns in the specified table.
 *     tags: ['meta']
 *     summary: 'list table columns'
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: The name of the table
 *         in: path
 *         required: true
 *         type: string 
 *     responses:
 *       200:
 *         description: list of columns (names and types)
 *       422:
 *         description: table not found or not accessible
 */
  app.get('/data/layer_columns/:table', async (req, res)=> {
    const sqlString = sql(req.params, req.query);
    try {
      const result = await pool.query(sqlString);
      res.json(result.rows);
    } catch (err) {
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