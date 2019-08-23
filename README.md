# PGServer
*Work in progress, many/some features still missing!*

Another PostGIS http API server  
Upload and download geo-data, preview, filter  
Serve cached mapbox vector tiles (mvt), geojson, geobuf

Built on [Node Express](https://expressjs.com/)

## Requirements
* access to a [PostGIS](https://postgis.net) server
* [Node and npm](https://nodejs.org/en/download/)

## Installation
If you don't have git, you can donwload [a zip file](https://github.com/anneb/pgserver/archive/master.zip) of the project instead.

     git clone this_repository
     cd this_repository
     npm install
     cp config/dbconfig.example.json config/dbconfig.json
     # now edit config/dbconfig.json for your PostGis database
     node pgserver.js
     # point your browser to localost:8090 for more info

For interactive data browsing, preview, administration and api documentation, head to [http://localhost:8090](http://localhost:8090).

### Attributions
API based on [Dirt Simple PostGIS http API](https://github.com/tobinbradley/dirt-simple-postgis-http-api)   
Map colors based on [ColorBrewer](http://colorbrewer2.org)