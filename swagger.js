const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
    info: {
        // API informations (required)
        title: 'PGServer', // Title (required)
        version: '1.0.0', // Version (required)
        description: 'PostGIS http api', // Description (optional)
      },
      basePath: '/', // Base path (optional)
}

const swaggerJSDocOptions = {
    swaggerDefinition,
    apis: ['./login.js', './mvt.js']
}

const swaggerSpec = swaggerJSDoc(swaggerJSDocOptions);

module.exports = function(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
