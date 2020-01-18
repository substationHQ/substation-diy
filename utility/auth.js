var db = require(__dirname + '/database.js');

/*******************************************************************
 *
 * BEGIN FUNCTIONS
 *
 *******************************************************************/
module.exports.validateNonce = function(email, nonce, callback) {
  var isvalid = false;
  // get a row count for email+nonce+datetime (1 = valid, 0 = not valid)
  db.get(
    'SELECT Count(*) as count from Nonces WHERE email = "' +
      email +
      '" AND nonce = "' +
      nonce +
      '" AND created > datetime("now","-24 hours")',
    function(err, row) {
      if (row.count) {
        isvalid = true;
      }
      // clean up old rows
      db.run('DELETE FROM Nonces WHERE email = "' + email + '"');

      // do the callback — it's a true/false check so there will be no error, but keep it for the footprint
      callback(null, isvalid);
    }
  );
}

module.exports.validateAPISecret = function(email, nonce, callback) {
  
}
