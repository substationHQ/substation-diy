/*********************************************************************
 *
 * SET UP OBJECTS AND INITIALIZE SERVER
 * All pretty standard. Set up our core objects. Initialize stuff
 * from the package.json file. Force SSL and other server environment
 * bits. Connect to Braintree.
 *
 *********************************************************************/

// load the .env variables if not found (aka: local development)
if (!process.env.SECURITY_SECRET) {
  require('dotenv').config();
}

// load server config and database initialization scripts
var app = require('./utility/server.js');
var db = require('./utility/database.js');

// handle routing
require('./controllers/index.js')(app,db);

// start up the server — different from local to live on glitch, elsewhere
if (process.argv.indexOf("dev")) {
  const https = require('https');
  const fs = require('fs');
  const key = fs.readFileSync('./config/key.pem');
  const cert = fs.readFileSync('./config/cert.pem');
  const ssl = https.createServer({key: key, cert: cert }, app);
  ssl.listen(process.env.PORT || 8080, () =>
    console.log(`△△ substation: listening on port ${process.env.PORT || 8080} (ssl)`)
  );
} else {
  app.listen(process.env.PORT || 8080, () =>
    console.log(`△△ substation: listening on port ${process.env.PORT || 8080}`)
  );
}