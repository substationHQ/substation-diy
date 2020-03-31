/********************************************************************
 *
 * UTILITY: auth.js ///
 * 
 * This module focuses on authenticating the login nonces we send
 * in lieu of permanent admin and/or member passwords. It may also
 * be expaneded to handle some of the API authentication, but that's
 * still in progress / TBD.
 *
 *******************************************************************/

// We need the db for this one
var db = require(__dirname + '/database.js');


/****** FUNCTION: auth.generateNonce() *****************************/
// Looks at email+nonce pairings in the database and checks them
// against a given input, expecting:
// (string)   email
// (function) callback(err,result)
module.exports.generateNonce = function(email, callback) {
  /*
  // enable basic uuids for a little later
  var { v1: uuidv1 } = require('uuid');
  var db = require(__dirname + "/database.js");
  // quickly generate a nonce
  var nonce = uuidv1();
  // assume we need the return, so store it in db
  db.serialize(function() {
    db.run(
      'INSERT INTO Nonces (email, nonce) VALUES ("' +
        email +
        '","' +
        nonce +
        '")'
    );
  });
  */
}

/****** FUNCTION: auth.validateNonce() *****************************/
// Looks at email+nonce pairings in the database and checks them
// against a given input, expecting:
// (string)   email
// (string)   nonce
// (function) callback(err,result)
module.exports.validateNonce = function(email, nonce, callback) {
  // default to false
  var isvalid = false;
  // get a row count for email+nonce+datetime (1 = valid, 0 = not valid)
  db.get(
    'SELECT Count(*) as count from Nonces WHERE email = "' +
      email + '" AND nonce = "' + nonce +
      '" AND created > datetime("now","-24 hours")',
    function(err, row) {
      if (row.count) {
        // we've found one that matches email and nonce, plus is 
        // within the 24 hour window. winner winner chicken dinner.
        isvalid = true;
      }
      // clean up old rows, no matter the result above. anything set
      // for this same email address should now be removed.
      db.run('DELETE FROM Nonces WHERE email = "' + email + '"');

      // do the callback — it's a true/false check so there will be 
      // no error, but keep it for the footprint
      callback(null, isvalid);
    }
  );
}

/****** FUNCTION: auth.getAPISecrets() *****************************/
// 
module.exports.getAPISecrets = function() {
  var users = require(__dirname + "/../models/users.js");
  var crypto = require('crypto');
  var admins = users.getAdminUsers();
  var secrets = {};
  admins.forEach(function(admin){
    secrets[admin] = crypto.createHash('sha256').update(admin + process.env.SECURITY_SECRET).digest('hex').substr(0,24);
  });
  return secrets;
}

/****** FUNCTION: auth.validateAPIToken() **************************/
// 
module.exports.validateAPIToken = function(request, response, next) {
  var jwt = require('jsonwebtoken');
  var users = require(__dirname + "/../models/users.js");
  
  var token = request.headers['x-access-token'];
  if (!token) {
    response.status(403).send({ auth: false, message: 'No token provided.' });
  } else {  
    jwt.verify(token, process.env.SECURITY_SECRET, function(err, decoded) {
      if (err) {
        response.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
      } else {
        // if everything good, save to request for use in other routes
        request.email = decoded.email;

        // now check for admin persmissions
        if (!users.isAdmin(request.email)) {
          response.status(401).send({ auth: false, message: 'Unauthorized.' });
        } else {
          // whew! next.
          next(); 
        }
      }
    });
  }
}