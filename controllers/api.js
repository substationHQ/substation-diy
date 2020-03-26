/********************************************************************
 *
 * CONTROLLERS: api.js ///
 * 
 * Work in progress.
 *
 *******************************************************************/
var auth = require(__dirname + "/../utility/auth.js");
var jwt = require('jsonwebtoken');

module.exports = function(app, db) {
  app.get("/api/v:version/metadata", auth.validateAPIToken, function(request, response) {
    response.status(200).send({ owner: process.env.TITLE, version: request.params.version });
  });
  
  app.get("/api/v:version/token", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    if(!request.query.email || !request.query.secret || !users.isAdmin(request.query.email)) {
      response.status(401).send({ auth: false, message: 'Unauthorized.' });
    } else {
      var secrets = auth.getAPISecrets();
      var secret = secrets[request.query.email];
      console.log(request.query.secret);
      if (request.query.secret !== secret) {
        response.status(401).send({ auth: false, message: 'Unauthorized.' });
      } else {
        var token = jwt.sign({"email":request.query.email}, process.env.SECURITY_SECRET, {
          expiresIn: 300 // expires in 5 minutes
        });
        response.status(200).send({"auth":true,"token": token});
      }
    }
  });
  
  app.get("/api/v:version/login", auth.validateAPIToken, function(request, response) {
    if(!request.query.email || !request.query.message || !request.query.redirect) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      /*
        1. API client requests token, uses it to request a login for a member
        2. The /login endpoint takes member email, a login message to be included
           in the login email, and a redirect URL back to teh API client
        3. The login email is sent out as usual, but with an extra parameter on 
           the button URL that includes the redirect URL from the API client
        4. The API authorizes the login, and if good generates a second nonce for the 
           email address, then passes both the email address and the nonce to
           the redirect URL specified in the original call
        5. The API client can then use it's API secret to request a new
           API token, trades the email and nonce back to the API server for
           confirmation of successful login
      */
    }
  });
  
  app.get("/api/v:version/member", auth.validateAPIToken, function(request, response) {
    var subscribers = require(__dirname + "/../models/subscribers.js");
    
    if(!request.query.email) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      // the "true" for isActive() is an object with first name, last name, 
      // active status, and the vendor subscription id
      subscribers.isActive(request.query.email,function(err, member) {
        if (err) {
          response.status(500).send({active: false, message: 'Error retreiving member data.'});
        } else {
          if (member) {
            // member is not active, so we don't send anything over API
            response.status(200).send({active:false});
          } else {
            // active is set to true for any members 
            // we're sending all basic data in this reponse, but only for active members
            response.status(200).send(member);
          }
        }
      });
    }
  });
  
};
