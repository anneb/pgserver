const sqlTableName = require('./utils/sqltablename.js');

const sql = (params, query) => {
    return `
    SELECT 
      ${query.columns}
  
    FROM 
    ${sqlTableName(params.table)}
  
    -- Optional Filter
    ${query.filter ? `WHERE ${query.filter}` : '' }
  
    -- Optional Group
    ${query.group ? `GROUP BY ${query.group}` : '' }
  
    -- Optional sort
    ${query.sort ? `ORDER BY ${query.sort}` : '' }
  
    -- Optional limit
    ${query.limit ? `LIMIT ${query.limit}` : '' }
  
    `
  }

module.exports = function(app, pool) {
/**
 * @swagger
 *
 * /data/query/{table}:
 *   get:
 *     description: Query a table or view.
 *     tags: ['api']
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: The name of the table or view.
 *         in: path
 *         required: true
 *         type: string
 *       - name: columns
 *         description: columns to return (default '*')
 *         in: query
 *         required: false
 *       - name: filter
 *         description: Optional filter parameters for a SQL WHERE statement.
 *         in: query
 *         required: false
 *         type: string
 *       - name: sort
 *         description: Optional sort by column(s).
 *         in: query
 *         required: false
 *         type: string
 *       - name: limit
 *         description: Optional limit to the number of output features.
 *         in: query
 *         required: false
 *         type: integer
 *       - name: group
 *         description: Optional column(s) to group by.
 *         in: query
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: query result
 *       422:
 *         description: invalid table or column name
 */
  app.get('/data/query/:table', async (req, res)=> {
    const sqlString = sql(req.params, req.query);
    try {
      const result = await pool.query(sqlString);
      res.json(result.rows);
    } catch (err) {
      res.status(422).json({error: err});
    }
  })
}
