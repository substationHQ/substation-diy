module.exports = function(app, db) {
  // dashboard page:
  app.get("/dashboard", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      },
      substationURL: process.env.URL
    };
    request.details.showadmin = false;
    
    // this is some clumsy bullshit to cache the totals we get from
    // the subscribers model. it's...not great
    var timestamp = Date.now();
    var pollTotals = true;
    if (request.session.subtotals) {
      if (request.session.subtotals.time + 1200000 > timestamp) {
        request.details.subscription = request.session.subtotals;
        var pollTotals = false;
      }
    }
    
    if (request.session.administrator) {
      request.details.showadmin = true;
      // this is repeated below. TODO: refactor so it's not dumb.
      if (pollTotals) {
        var subscribers = require(__dirname + "/../models/subscribers.js");
        subscribers.getTotals(function(err, sub) {
          if (sub) {
            sub.time = timestamp;
            request.details.subscription = sub;
            request.session.subtotals = sub;
          }
          response.render("dashboard", request.details);
        });
      } else {
        response.render("dashboard", request.details);
      }
    } else {
      if (request.query.email && users.isAdmin(request.query.email)) {
        if (request.query.nonce) {
          // returning from a login email
          console.log("admin login attempt: " + request.query.nonce);
          var auth = require(__dirname + "/../utility/auth.js");
          auth.validateNonce(
            request.query.email,
            request.query.nonce,
            function(err, data) {
              if (data) {
                request.session.administrator = true;
                request.details.showadmin = true;
              }
              request.details.showadmin = true;
              // this is repeated above. TODO: refactor so it's not dumb.
              if (pollTotals) {
                var subscribers = require(__dirname + "/../models/subscribers.js");
                subscribers.getTotals(function(err, sub) {
                  if (sub) {
                    sub.time = timestamp;
                    request.details.subscription = sub;
                    request.session.subtotals = sub;
                  }
                  response.render("dashboard", request.details);
                });
              } else {
                response.render("dashboard", request.details);
              }
            }
          );
        } else {
          // requesting a login — send a link
          var mailer = require(__dirname + "/../utility/messaging.js");
          
          mailer.sendMessage(
            app,
            request.query.email,
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
      },
      scriptNonce: app.scriptNonce
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
        var sendToAll = false;
        if (!request.body.sending) {
          request.body.subject += ' [TEST]'; 
        } else {
          var sendToAll = true;
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
