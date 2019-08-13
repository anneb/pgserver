const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
    info: {
        // API informations (required)
        title: 'PGServer', // Title (required)
        version: '0.0.1', // Version (required)
        description: 'PostGIS http api', // Description (optional)
      },
      tags: [
        {
          name: 'meta',
          description: 'meta information for tables and views'
        },
        {
          name: 'geodata',
          description: 'features in common formats for direct mapping'
        }
      ],
      basePath: '/', // Base path (optional)
}

const swaggerJSDocOptions = {
    swaggerDefinition,
    apis: ['./login.js', './mvt.js', './list_layers.js', './layer_columns.js', './bbox.js', './geojson.js', './geobuf.js']
}

const swaggerSpec = swaggerJSDoc(swaggerJSDocOptions);

module.exports = function(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
