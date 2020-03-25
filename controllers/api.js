/********************************************************************
 *
 * CONTROLLERS: api.js ///
 * 
 * Work in progress.
 *
 *******************************************************************/
var auth = require(__dirname + "/../utility/auth.js");
var users = require(__dirname + "/../models/users.js");
var jwt = require('jsonwebtoken');

module.exports = function(app, db) {
  app.get("/api/v:version/metadata", auth.validateAPIToken, function(request, response) {
    response.status(200).send({ owner: process.env.TITLE, version: request.params.version });
  });
  
  app.get("/api/v:version/token", function(request, response) {
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
    if(!request.query.email || !request.query.redirect) {
      response.status(400).send({ auth: false, message: 'Bad request.' });
    } 
  });
  
  app.get("/api/v:version/members", auth.validateAPIToken, function(request, response) {
    response.status(200).send({"auth":true,"worked": "yay!"});
    if(request.query.email) {
      //response.status(401).send({ auth: false, message: 'Unauthorized.' });
    } 
  });
  
};
