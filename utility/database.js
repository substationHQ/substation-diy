/********************************************************************
 *
 * UTILITY: database.js ///
 * 
 * The database is only used for issuing one-time nonce tokens to
 * verify a user either for login or for unsubscribe.
 *
 * Even if the server sleeps, the database persists. That said —
 * if it's lost it's not a tragedy for the app. All real data is
 * stored in Braintree, so should the database get blown away by
 * some server fluke a user needs only retry their login/unsubscribe
 * request and it will set itself up again.
 *
 * This module either initializes or connects to our SQLite db in 
 * the hidden .data/ directory.
 *
 *******************************************************************/

// set up what we need for the db
var sqlite3 = require("sqlite3").verbose();
var dbFile = __dirname + "/../.data/sqlite.db";

// connect to things and set the db object
let db = new sqlite3.Database(dbFile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function(err) {
  if(err) {
    // can't open database
    console.error("Can't open database: " + err.message);
  } else {
    db.run(
      "CREATE TABLE IF NOT EXISTS Nonces (email TEXT, nonce TEXT, created TEXT default current_timestamp)"
    );
    console.log("SQLite database initialized.");
  }
});

// export the db object so it's available whenever this script is
// required elsewhere.
module.exports = db;