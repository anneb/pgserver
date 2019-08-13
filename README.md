# PGServer
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
     npm start
     # point your browser to localost:8090 for more info


### Due credit
API based on [Dirt Simple PostGIS http API](https://github.com/tobinbradley/dirt-simple-postgis-http-api)