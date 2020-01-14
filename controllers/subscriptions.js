module.exports = function(app, db) {
  // return from unsubscribe request
  app.get("/unsubscribe", function(request, response) {
    // set up variables we'll use when we're done here
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      },
      showgoodbye: false
    };

    // do we have an email and a nonce? is the email different from the admin? GO TIME
    if (request.query.nonce && request.query.email) {
      // first validate the email and nonce combo
      var auth = require(__dirname + "/../utility/auth.js");
      auth.validateNonce(request.query.email, request.query.nonce, function(
        err,
        data
      ) {
        // if data = true then do unsubscribe
        if (data) {
          var subscribers = require(__dirname + "/../models/subscribers.js");
          subscribers.remove(request.query.email, function(err, status) {
            if (err) {
              // error defaults to true in the view — no additional details needed
              console.log("Braintree error: " + err);
              response.render("unsubscribe", request.details);
            } else {
              request.details.showgoodbye = true;
              response.render("unsubscribe", request.details);
            }
          });
        } else {
          // data (nonce validation) came back false, so... oops?
          console.log("Email address and nonce not a valid combination.");
          response.render("unsubscribe", request.details);
        }
      });
    } else {
      console.log("Email address and/or nonce not set in url.");
      response.render("unsubscribe", request.details);
    }
  });

  app.post("/subscribe", function(request, response) {
    if (request.body.email) {
      var subscribers = require(__dirname + "/../models/subscribers.js");
      subscribers.add(
        request.body.email,
        request.body.firstName,
        request.body.lastName,
        request.body.nonce,
        request.body.amount,
        function(err, status) {
          if (err) {
            // sends a 402 (or other error) from the add function
            response.sendStatus(err);
          } else {
            // sends 200 or current status
            response.sendStatus(status);      
          }
        }
      );
    } else {
      response.sendStatus(404);
    }
  });

  // create new nonce and send unsubscribe link
  app.post("/unsubscribe", function(request, response) {
    var mailer = require(__dirname + "/../utility/messaging.js");
    mailer.sendToken(
      request.body.email,
      "Cancel " + process.env.TITLE + " membership",
      "We're sorry to see you go.",
      "To cancel membership in " + process.env.TITLE + " click here.",
      "Cancel payments",
      process.env.URL + "unsubscribe"
    );
    response.sendStatus(200);
  });
};
