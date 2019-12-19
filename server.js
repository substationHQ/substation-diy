/*********************************************************************
 *
 * SET UP OBJECTS AND INITIALIZE SERVER
 * All pretty standard. Set up our core objects. Initialize stuff
 * from the package.json file. Force SSL and other server environment
 * bits. Connect to Braintree.
 *
 *********************************************************************/
var express = require("express");
var session = require("express-session");
var bodyParser = require("body-parser");
var braintree = require("braintree");
var mailgen = require("mailgen");
var mailgun = require("mailgun-js");
var mustacheExpress = require("mustache-express");
var uuid = require("uuid/v1");

var mg = false;
var mailGenerator = false;

// instantiate express and do settings
var app = express();
app.use(
  session({
    secret: process.env.SECURITY_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 360000
    }
  })
);

// parse every kind of request automatically
app.use(bodyParser.urlencoded({ extended: true }));
// directly serve static files from the public folder
app.use(express.static("public"));
// mustache-express settings
app.engine("html", mustacheExpress()); // register .html extension
app.disable("view cache"); // <--------------------------------------------------- COMMENT OUT IN PRODUCTION
app.set("view engine", "html"); // set the engine
app.set("views", __dirname + "/views"); // point at our views

// force SSL
function checkHttps(req, res, next) {
  // protocol check, if http, redirect to https
  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) {
    return next();
  } else {
    console.log("redirecting to ssl");
    res.redirect("https://" + req.hostname + req.url);
  }
}
app.all("*", checkHttps);

// set up braintree
var gateway = braintree.connect({
  environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

// load database initialization script
var db = require('./database.js')


/*********************************************************************
 *
 * ROUTING TABLE
 * http://expressjs.com/en/starter/basic-routing.html
 *
 *********************************************************************/

// serve domain root:
app.get("/", function(request, response) {
  // get a token, wait, then render the page
  //
  // TODO: handle the error case already. Damn.
  gateway.clientToken.generate({ version: 3 }, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      //console.log(res);
      var sandboxed = false;
      if (process.env.BRAINTREE_ENVIRONMENT == "Sandbox") {
        sandboxed = true;
      }
      request.details = {
        braintree: {
          clientToken: res.clientToken,
          planId: process.env.BRAINTREE_PLAN_ID,
          minimumCost: process.env.BRAINTREE_MINIMUM_COST
        },
        copy: {
          title: process.env.TITLE,
          description: process.env.DESCRIPTION
        },
        style: {
          titleColor: process.env.STYLE_TITLE_COLOR,
          textColor: process.env.STYLE_TEXT_COLOR,
          backgroundColor: process.env.STYLE_BACKGROUND_COLOR,
          backgroundImage: process.env.STYLE_BACKGROUND_IMAGE
        },
        sandboxed: sandboxed
      };
    }
    response.render("index", request.details);
  });
});

// csv download
app.get("/export", function(request, response) {
  if (request.session.administrator) {
    response.setHeader("Content-Type", "text/csv");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="' + "download-" + Date.now() + '.csv"'
    );

    request.details = {
      copy: {
        title: process.env.TITLE,
        description: process.env.DESCRIPTION
      }
    };

    showActiveSubscribers(request, response, "export");
  }
});

// dashboard page:
app.get("/dashboard", function(request, response) {
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
    if (request.query.email == process.env.ADMIN_EMAIL) {
      if (request.query.nonce) {
        // returning from a login email
        console.log("admin login attempt: " + request.query.nonce);
        validateNonce(process.env.ADMIN_EMAIL, request.query.nonce, function(
          err,
          data
        ) {
          if (data) {
            request.session.administrator = true;
            request.details.showadmin = true;
          }
          response.render("dashboard", request.details);
        });
      } else {
        // requesting a login — send a link
        sendToken(
          process.env.ADMIN_EMAIL,
          "Log in link for " + process.env.TITLE,
          "Here you go.",
          "To log in just gollow this link. It's a one-time link like a password reset, but you never have to worry about a password.",
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

    validateNonce(request.query.email, request.query.nonce, function(
      err,
      data
    ) {
      // if data = true then do unsubscribe
      if (data) {
        // TODO: can't get the customers as an iterable array/object
        // so we wind up in this nested loopsy upside-down place.
        // Technically we're fine. There should onle be ONE match for
        // any given email, but that doesn't feel like a solid or stable
        // thing to build on. For now it's what we've got.
        //
        // We currently iterate through every sub for each customer then
        // deal with cancelations at the end to avoid race conditions on a
        // per-user basis.
        
        var stream = gateway.customer.search(
          function(search) {
            search.email().is(request.query.email);
          },
          function(err, customers) {
            if (err) {
              // error defaults to true
              console.log('Braintree error: ' + err);
              response.render("unsubscribe", request.details);
            } else {
              console.log('total customers: ' + customers.length());
              customers.each(function(err, customer) {
                // found at least that this email once belonged to a valid customer
                
                if (err) {
                  // error defaults to true
                  console.log('Braintree error: ' + err);
                  response.render("unsubscribe", request.details);
                } else {
                  // we found at least one subscription, but we don't know yet if any are active.
                  // if the nonce is valid and we made it this far it's safe to assume the user
                  // is trying to cancel their subscription, even if they already have, so we show
                  // them success that they are indeed unsubscribed no matter what.

                  // loooooooooooooops (credit cards)
                  for (
                    var ii = 0, len = customer.creditCards.length;
                    ii < len;
                    ii++
                  ) {
                    var card = customer.creditCards[ii];
                    //console.log("CARD: " + card.bin);
                    // more loooooooooooooooooooooooops (subscriptions)
                    for (
                      var iii = 0, le = card.subscriptions.length;
                      iii < le;
                      iii++
                    ) {
                      var subscription = card.subscriptions[iii];

                      console.log("SUB: " + subscription.id);
                      console.log("SUB PLAN: " + subscription.planId);
                      console.log("SUB STATUS: " + subscription.status);

                      if (
                        subscription.status == "Active" &&
                        subscription.planId == process.env.BRAINTREE_PLAN_ID
                      ) {
                        gateway.subscription.cancel(subscription.id, function(err, result) {
                          //console.log(JSON.stringify(err));
                          //console.log(JSON.stringify(result));
                          if (result) {
                            request.details.showgoodbye = true;
                          }
                          response.render("unsubscribe", request.details);
                        });
                      } else {
                        console.log('subscription already canceled');
                        // show the success message — this is a funny situation as there's a time 
                        // where the user can cancel their sub but still be seen as 'active' until
                        // their subscription period ends. better to reassure the user than give a 
                        // false error message if they're trying a second time...
                        request.details.showgoodbye = true;
                        response.render("unsubscribe", request.details);
                      }
                    }
                  }
                }
              });
            }
          }
        );
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
  var result = gateway.customer.search(function(search) {
    search.email().is(request.body.email);
  });
  if (result.success) {
    // customer already exists. we should check if they're active,
    // and if not then we sign them up for a new sub at the rate
    // they selected. if they are...do nothing?
    // Customer.creditCards
    //    - each.subscriptions
    //        - each.planId
    //        - each.status ("Active")
    // Customer.paypalAccounts[each]
    //    - each.subscriptions
    //        - each.planId
    //        - each.status ("Active")
  } else {
    var finalPrice = process.env.BRAINTREE_MINIMUM_COST;
    if (request.body.amount > finalPrice) {
      finalPrice = request.body.amount;
    }

    gateway.customer.create(
      {
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        email: request.body.email,
        paymentMethodNonce: request.body.nonce,
        creditCard: {
          options: {
            verifyCard: true
          }
        }
      },
      function(err, res) {
        if (res.success) {
          // res.customer.id; // e.g 160923
          gateway.subscription.create(
            {
              paymentMethodToken: res.customer.paymentMethods[0].token,
              planId: process.env.BRAINTREE_PLAN_ID,
              price: finalPrice
            },
            function(e, r) {
              // this is where we find out if it worked and send a response
              //
              // TODO/MAILGUN: send welcome email to [request.body.email]
              //
              // console.log(JSON.stringify(r));
              response.sendStatus(200);
            }
          );
        } else {
          // Card processing failed. Send a PaymentRequired 402
          response.sendStatus(402);
        }
      }
    );
  }
});

// create new nonce and send unsubscribe link
app.post("/unsubscribe", function(request, response) {
  sendToken(
    request.body.email,
    "Cancel " + process.env.TITLE + " membership",
    "We're sorry to see you go.",
    "To cancel membership in " + process.env.TITLE + " click here.",
    "Cancel payments",
    process.env.URL + "unsubscribe"
  );
  response.sendStatus(200);
});

/*********************************************************************
 *
 * GENERAL FUNCTIONS
 * Pretty much just some junk to validate nonces or do mailings
 *
 *********************************************************************/
function validateNonce(email, nonce, callback) {
  var isvalid = false;
  // get a row count for email+nonce+datetime (1 = valid, 0 = not valid)
  db.get(
    'SELECT Count(*) as count from Nonces WHERE email = "' +
      email +
      '" AND nonce = "' + nonce +  
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

function sendToken(
  emailaddress,
  subject,
  intro,
  instructions,
  buttontext,
  url
) {
  var nonce = uuid();
  db.serialize(function() {
    db.run(
      'INSERT INTO Nonces (email, nonce) VALUES ("' +
        emailaddress +
        '","' +
        nonce +
        '")'
    );
  });

  prepMailing();

  // prep the outgoing email
  var email = {
    body: {
      name: "",
      intro: intro,
      action: {
        instructions: instructions,
        button: {
          color: "#22BC66", // Optional action button color
          text: buttontext,
          link: url + "?email=" + emailaddress + "&nonce=" + nonce
        }
      }
    }
  };
  var emailBody = mailGenerator.generate(email); // html version of the email
  var emailText = mailGenerator.generatePlaintext(email); // plain text version of the email

  var data = {
    from: process.env.MAILGUN_FROM_EMAIL,
    to: emailaddress,
    subject: subject,
    text: emailText,
    html: emailBody
  };

  mg.messages().send(data, function(error, body) {
    if (error) {
      console.log("There was an error sending email. Details:");
      console.log(JSON.stringify(body));
    }
  });
}

function showActiveSubscribers(request, response, template) {
  var users = [
    {
      firstName: "firstName",
      lastName: "lastName",
      email: "email"
    }
  ];
  var stream = gateway.subscription.search(
    function(search) {
      search.planId().is(process.env.BRAINTREE_PLAN_ID);
      search.status().is("Active");
    },
    function(err, subs) {
      if (err) {
        request.details.error = "Braintree error message: " + err.message;
        response.render("dashboard", request.details);
      } else {
        var len = subs.length();
        var count = 0;
        subs.each(function(err, subscription) {
          if (subscription.transactions[0].customer.email !== "") {
            users.push({
              firstName: subscription.transactions[0].customer.firstName,
              lastName: subscription.transactions[0].customer.lastName,
              email: subscription.transactions[0].customer.email
            });
            //console.log(JSON.stringify(users));
            //console.log(subscription.transactions[0].customer.email);
          }
          count++;
          if (count == len) {
            request.details.users = users;
            response.render(template, request.details);
          }
        });
      }
    }
  );
}

function prepMailing() {
  // set up mailgun
  mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  });

  // set up mailgen (email templating)
  mailGenerator = new mailgen({
    theme: "salted",
    product: {
      // Appears in header & footer of e-mails
      name: process.env.TITLE,
      link: process.env.URL
    }
  });
}

/*********************************************************************
 *
 * START THE SERVER & LISTEN FOR REQUESTS
 *
 *********************************************************************/
app.listen(process.env.PORT || 8080, () =>
  console.log(`Your app is listening on port ${process.env.PORT || 8080}`)
);
