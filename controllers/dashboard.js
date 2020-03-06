/********************************************************************
 *
 * CONTROLLERS: dashboard.js ///
 * 
 * This controller handles all of routes for the dashboard and all
 * admin functionality. This includes real-time stats, the mailings
 * interface, and member list exports. 
 *
 *******************************************************************/

module.exports = function(app, db) {
  /****** ROUTE: /dashboard ****************************************/
  // This route does the main admin page, which has a few moving
  // parts. It requires a logged-in user so there's that gateway,
  // then also we need to collect stats after a user completes a 
  // login loop. So there are a few layers.
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
    // the subscribers model. it's...not great but it works
    var timestamp = Date.now();
    var pollTotals = true;
    if (request.session.subtotals) {
      if (request.session.subtotals.time + 1200000 > timestamp) {
        request.details.subscription = request.session.subtotals;
        var pollTotals = false;
      }
    }
    
    // now let's check for admin login status
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
      // not currently logged in as an admin, so check for form actions
      // first make sure the email is set and has admin permissions
      if (request.query.email && users.isAdmin(request.query.email)) {
        // if the nonce is set we're returning from a login email
        if (request.query.nonce) {
          console.log("admin login attempt: " + request.query.nonce);
          var auth = require(__dirname + "/../utility/auth.js");
          // check the one-time nonce against the email it was sent to
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
          // there's no nonce present, which means this is a request 
          // for a new one to be sent to the admin
          var mailer = require(__dirname + "/../utility/messaging.js");
          
          // way back up in this block's if statement we check to make
          // sure the email has admin permissions. since we're here, we
          // know it does, so we hand it all over to the messaging 
          // script to create, store, and send out the nonce.
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

  /****** ROUTE: /export *******************************************/
  // Pulls a list of all current subscribers and exports a CSV with
  // first name, last name, and email addresses for everyone.
  app.get("/export", function(request, response) {
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      }
    };

    if (request.session.administrator) {
      // a quick call to the Braintree API to get active members
      // (non-canceled/expired users in good standing.)
      var subscribers = require(__dirname + "/../models/subscribers.js");
      subscribers.getActive(function(err, subs) {
        if (err) {
          console.log("export error");
          request.details.error = "Braintree error message: " + err.message;
          response.render("dashboard", request.details);
        } else {
          // generate the CSV and set the appropriate headers
          console.log("export download initiated");
          response.setHeader("Content-Type", "text/csv");
          response.setHeader(
            "Content-Disposition",
            'attachment; filename="' + "download-" + Date.now() + '.csv"'
          );
          request.details.users = subs;
          // note that this maps to /views/export.html —> which is 
          // pretty dumb since it's CSV but the rendering engine picks
          // it up automatically with the html extension so here we 
          // are. edit that to edit the CSV. [DEAL_WITH_IT.GIF]
          response.render("export", request.details);
        }
      });
    } else {
      console.log("export error — not logged in");
      response.render("dashboard", request.details);
    }
  });
  
  /****** ROUTE: /mailing (GET) ************************************/
  // Renders the mailing form in the admin
  app.get("/mailing", function(request, response) {
    var users = require(__dirname + "/../models/users.js");
    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      },
      scriptNonce: app.scriptNonce
    };
    // this one feels like it should be complicated but there's 
    // not much to do in showing the basic composer form
    request.details.showadmin = false;
    if (request.session.administrator) {
      request.details.showadmin = true;
      response.render("mailing", request.details);
    } else {
      response.render("mailing", request.details);
    }
  });
  
  /****** ROUTE: /mailing (POST) ***********************************/
  // POST endpoint for sending mass mailings (and tests)
  app.post("/mailing", function(request, response) {
    if (request.session.administrator) {
      if (request.body.subject && request.body.contents) {
        var sendToAll = false;
        if (!request.body.sending) {
          request.body.subject += ' [TEST]'; 
        } else {
          var sendToAll = true;
        }
        
        // we have all the data/content we need so we call in the 
        // messaging script to start the mailing
        var messaging = require(__dirname + "/../utility/messaging.js");
              
        // this passes the job on to messaging for a mass-mail send
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
