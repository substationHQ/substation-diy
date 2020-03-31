/********************************************************************
 *
 * CONTROLLERS: api.js ///
 * 
 * Handles the API interface, issuing only JSON responses. The API
 * itself is not complex, so in the interest of security each API 
 * token only has a 5 minute lifetime. The tokens are formatted as 
 * JSON web tokens with the expectation that a new token will be 
 * requested for each new request. Those tokens are passed back to
 * the API in an x-access-token header which is verified by a 
 * middleware which lives in auth.js
 *
 * The API itself serves a few core use cases around validating 
 * users as being in good standing or initiating a new user login
 * with a special redirect parameter added to pass the login status
 * (with a verification step) on to an external client.
 *
 * Each API call includes a version number. These are not currently
 * doing anything, but will allow us to make changes down the road
 * while supporting old versions, etc.
 *
 *******************************************************************/
var auth = require(__dirname + "/../utility/auth.js");
var jwt = require('jsonwebtoken');

module.exports = function(app, db) {
  /****** ROUTE: /metadata (GET) ***********************************/
  // A basic route that gives the title of this Substation instance
  // and parrots the version number requested in the URI.
  app.get("/api/v:version/metadata", auth.validateAPIToken, function(request, response) {
    response.status(200).send({ owner: process.env.TITLE, version: request.params.version });
  });
  
  /****** ROUTE: /token (GET) **************************************/
  // Takes an email and secret FROM A SECURE CLIENT — do not use 
  // this in a front-end script as it will reveal your password and
  // make you have to change your security secret and generally be
  // really dumb and bad.
  //
  // The JSON response will attach the token to its token parameter
  // (Duh.) and the client should then pass it as the value of the 
  // x-access-token HTTP header as it makes a full API request.
  //
  // Note: this route DOES NOT use the token validation middleware
  //       because there is no token yet. Obvs.
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
  
  /****** ROUTE: /login (GET) **************************************/
  // Takes an email and secret FROM A SECURE CLIENT — do not use 
  // this in a front-end script as it will reveal your password and
  // make you have to change your security secret and generally be
  // really dumb and bad.
  app.get("/api/v:version/login", auth.validateAPIToken, function(request, response) {
    if(!request.query.email || !request.query.redirect) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      /*
        FULL LOGIN FLOW (ISH) - DOCUMENT THIS SHIT BETTER
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
      var subscribers = require(__dirname + "/../models/subscribers.js");
            
      // first we check to ensure the subscriber is in good standing
      subscribers.getStatus(request.query.email,function(err, member) {
        if (err) {
          response.status(500).send({active: false, message: 'Error retreiving member data.'});
        } else {
          if (!member) {
            // send a nope
            response.status(401).send({message: 'Unauthorized.',login:false});
          } else {
            var mailer = require(__dirname + "/../utility/messaging.js");
            var url = require('url');
            var redirectURL = new URL(request.query.redirect);
            mailer.sendMessage(
              app,
              request.query.email,
              "Log in to " + process.env.TITLE,
              "Just click to login. You will be redirected to <u>" + redirectURL.hostname + "</u> after your login is complete.",
              "login",
              "Log in now",
              process.env.URL + "api/v" + request.params.version + "/login/finalize",
              encodeURI(request.query.redirect)
            );
            response.status(200).send({loginRequested:true});
          }
        }
      });
    }
  });
  
  /****** ROUTE: /login/finalize (GET) *****************************/
  // The finalize route looks for an email and a nonce sent to the 
  // user and included in a confirmation link in that email. The 
  // user is prompted to log in and told they will be redirected
  // to an external site as set by the client upon login request. 
  // 
  // If the email and nonce validate properly then the user will 
  // be redirected with their email and a new verification nonce to
  // the redirect URL, which will then verify that email+nonce
  // combination. If they do not validate 
  //
  // Note: this route DOES NOT use the token validation middleware
  //       because it is a return from an in-email link.
  app.get("/api/v:version/login/finalize", function(request, response) {
    if(!request.query.email || !request.query.nonce || !request.query.redirect) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      auth.validateNonce(
        request.query.email,
        request.query.nonce,
        function(err, data) {
          if (data) {
            // TODO: CENTRALIZE NONCE GEN IN auth.js
            // we're generating a second nonce to use as verification of this request
            // the client will get the email/nonce and a true result from /api/verify 
            // will verify that it was a true request processed by substation
            var { v1: uuidv1 } = require('uuid');
            var db = require(__dirname + "/../utility/database.js");
            // quickly generate a nonce
            var nonce = uuidv1();
            // assume we need the return, so store it in db
            db.serialize(function() {
              db.run(
                'INSERT INTO Nonces (email, nonce) VALUES ("' +
                  request.query.email +
                  '","' +
                  nonce +
                  '")'
              );
            });
            // pass email and nonce for verification
            response.redirect(request.query.redirect + '?substation-email=' + request.query.email + '&substation-nonce=' + nonce);
          } else {
            // pass just an email on failure. without the nonce verification 
            // will fail but the client will still know that the API->email->client-site
            // journey has been completed
            response.redirect(request.query.redirect + '?substation-email=' + request.query.email);
          }
        }
      );
    }
  });
  
  /****** ROUTE: /login/verify (GET) *******************************/
  // This simple method will take the email address and nonce passed
  // to the redirect URL a client sets when asking for the initial 
  // login requets. If the email+nonce matches we know the request
  // was valid/secure as sent in the API->email->client-site 
  // journey. Without this additional step we'd be asking API 
  // clients to blindly accept easily spoofed querystrings. Using a
  // nonce allows us an extra layer of confidence in this status.
  // 
  // Returns a boolean "login" value for the given email address.
  app.get("/api/v:version/login/verify", auth.validateAPIToken, function(request, response) {
    if(!request.query.email || !request.query.nonce) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      auth.validateNonce(
        request.query.email,
        request.query.nonce,
        function(err, data) {
          if (data) {
            response.status(200).send({message: 'Success.',login:true});
          } else {
            response.status(401).send({message: 'Unauthorized.',login:false});  
          }
        }
      );
    }
  });
  
  /****** ROUTE: /login/member (GET) *******************************/
  // Gets member data/status for a given member (email address.) 
  // This will return nothing but an "active: false" if the user 
  // is no longer active/in good standing, but if the member is 
  // active it will give firstName, lastName, email, and active
  app.get("/api/v:version/member", auth.validateAPIToken, function(request, response) {
    var subscribers = require(__dirname + "/../models/subscribers.js");
    
    if(!request.query.email) {
      response.status(400).send({message: 'Bad request.'});
    } else {
      // the "true" for getStatus() is an object with first name, last name, 
      // active status, and the vendor subscription id
      subscribers.getStatus(request.query.email,function(err, member) {
        if (err) {
          response.status(500).send({active: false, message: 'Error retreiving member data.'});
        } else {
          if (!member) {
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
