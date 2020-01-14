/*********************************************************************
 *
 * SET UP OBJECTS AND INITIALIZE SERVER
 * All pretty standard. Set up our core objects. Initialize stuff
 * from the package.json file. Force SSL and other server environment
 * bits. Connect to Braintree.
 *
 *********************************************************************/

// load server config and database initialization scripts
var app = require('./utility/server.js');
var db = require('./utility/database.js');

// handle routing
require('./controllers/index.js')(app,db);

// start up the server
app.listen(process.env.PORT || 8080, () =>
  console.log(`Your app is listening on port ${process.env.PORT || 8080}`)
);
