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

/****** FUNCTION: auth.validateAPISecret() *************************/
// Placeholder.
module.exports.validateAPISecret = function(email, signature, callback) {
  
}
