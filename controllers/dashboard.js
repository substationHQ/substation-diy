module.exports = function(app, db) {
  // dashboard page:
  app.get("/dashboard", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      }
    };
    request.details.showadmin = false;
    if (request.session.administrator) {
      request.details.showadmin = true;
      response.render("dashboard", request.details);
    } else {
      if (users.isAdmin(request.query.email)) {
        if (request.query.nonce) {
          // returning from a login email
          console.log("admin login attempt: " + request.query.nonce);
          var auth = require(__dirname + "/../utility/auth.js");
          auth.validateNonce(
            process.env.ADMIN_EMAIL,
            request.query.nonce,
            function(err, data) {
              if (data) {
                request.session.administrator = true;
                request.details.showadmin = true;
              }
              response.render("dashboard", request.details);
            }
          );
        } else {
          // requesting a login — send a link
          var mailer = require(__dirname + "/../utility/messaging.js");
          
          mailer.sendMessage(
            app,
            process.env.ADMIN_EMAIL,
            "Log in to " + process.env.TITLE,
            "Just click to login.",
            "login",
            "Log in now",
            process.env.URL + "dashboard"
          );
          
          request.details.postsend = true;
          response.render("dashboard", request.details);
        }
      } else {
        response.render("dashboard", request.details);
      }
    }
  });

  // csv download
  app.get("/export", function(request, response) {
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      }
    };

    if (request.session.administrator) {
      var subscribers = require(__dirname + "/../models/subscribers.js");
      subscribers.getActive(function(err, subs) {
        if (err) {
          console.log("export error");
          request.details.error = "Braintree error message: " + err.message;
          response.render("dashboard", request.details);
        } else {
          console.log("export download initiated");
          response.setHeader("Content-Type", "text/csv");
          response.setHeader(
            "Content-Disposition",
            'attachment; filename="' + "download-" + Date.now() + '.csv"'
          );
          request.details.users = subs;
          response.render("export", request.details);
        }
      });
    } else {
      console.log("export error — not logged in");
      response.render("dashboard", request.details);
    }
  });
  
  // mailing page:
  app.get("/mailing", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      }
    };
    request.details.showadmin = false;
    if (request.session.administrator) {
      request.details.showadmin = true;
      response.render("mailing", request.details);
    } else {
      response.render("mailing", request.details);
    }
  });
  
  // mailing action
  app.post("/mailing", function(request, response) {
    if (request.session.administrator) {
      if (request.body.subject && request.body.contents) {
        if (!request.body.sending) {
          request.body.subject += ' [TEST]'; 
        }
        //console.log(request.body.subject + "\n\n" + request.body.contents);
        var messaging = require(__dirname + "/../utility/messaging.js");
        messaging.sendMailing(
          app,
          request.body.subject,
          request.body.contents,
          request.body.sending
        );
        response.sendStatus(200);
      } else {
        response.sendStatus(404);
      }
    } else {
      response.sendStatus(403);
    }
  });
};
