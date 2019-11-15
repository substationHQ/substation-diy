/*********************************************************************
 *
 * SET UP OBJECTS AND INITIALIZE SERVER
 * All pretty standard. Set up our core objects. Initialize stuff
 * from the package.json file. Force SSL and other server environment
 * bits. Connect to Braintree.
 *
 *********************************************************************/
var express = require('express');
var session = require('express-session');
var fs = require('fs');
var bodyParser = require('body-parser');
var braintree = require("braintree");
var mailgen = require('mailgen');
var mailgun = require("mailgun-js");
var mustacheExpress = require('mustache-express');
var sqlite3 = require('sqlite3').verbose();
var uuid = require('uuid/v1');

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
app.use(express.static('public'));
// mustache-express settings
app.engine('html', mustacheExpress()); // register .html extension
app.disable('view cache'); // <--------------------------------------------------- COMMENT OUT IN PRODUCTION
app.set('view engine', 'html'); // set the engine
app.set('views', __dirname + '/views'); // point at our views

// force SSL
function checkHttps(req, res, next){
  // protocol check, if http, redirect to https
  if(req.get('X-Forwarded-Proto').indexOf("https")!=-1){
    return next();
  } else {
    console.log("redirecting to ssl");
    res.redirect('https://' + req.hostname + req.url);
  }
}
app.all('*', checkHttps);

// set up braintree
var gateway = braintree.connect({
  environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

/*********************************************************************
 *
 * DATABASE SETUP
 * The database is only used for issuing one-time nonce tokens to 
 * verify a user either for login or for unsubscribe. 
 *
 * Even if the server sleeps, the database persists. That said —
 * if it's lost it's not a tragedy for the app. All real data is 
 * stored in Braintree, so should the database get blown away by 
 * some server fluke a user needs only retry their login/unsubscribe
 * request and it will set itself up again.
 *
 *********************************************************************/
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(function(){
  if (!exists) {
    db.run('CREATE TABLE Nonces (email TEXT, nonce TEXT, created datetime default current_timestamp)');
    console.log('SQLite database initialized, Nonces table created.');
    
    /*
    // UNCOMMENT FOR TESTING ONLY
    // Attempt a test write to the new database
    db.serialize(function() {
      db.run('INSERT INTO Nonces (email, nonce) VALUES ("testemail","testnonce")');
    });
    */

  }
  else {
    console.log('SQLite database ready.');
    
    /*
    // UNCOMMENT FOR TESTING ONLY
    // Validate the test write and database persistence
    db.each('SELECT * from Nonces', function(err, row) {
      if ( row ) {
        // loop through
        console.log('record:', row);
      }
    });
    */
    
  }
});


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
  gateway.clientToken.generate({version:3}, function (err, res) {
    if (err) {
      console.log(err);
    } else {
      //console.log(res);
      var sandboxed = false;
      if (process.env.BRAINTREE_ENVIRONMENT == "Sandbox") {
        sandboxed = true;
      }
      var details = {
        "braintree":{
          "clientToken":res.clientToken,
          "planId":process.env.BRAINTREE_PLAN_ID,
          "minimumCost":process.env.BRAINTREE_MINIMUM_COST
        },
        "copy":{
          "title":process.env.TITLE,
          "description":process.env.DESCRIPTION
        },
        "style": {
          "titleColor":process.env.STYLE_TITLE_COLOR,
          "textColor":process.env.STYLE_TEXT_COLOR,
          "backgroundColor":process.env.STYLE_BACKGROUND_COLOR,
          "backgroundImage":process.env.STYLE_BACKGROUND_IMAGE
        },
        "sandboxed":sandboxed
      }
    }
    response.render('index', details); 
  });
});

// csv download
app.get("/export", function(request, response) {

  if (request.session.administrator) {
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', 'attachment; filename=\"' + 'download-' + Date.now() + '.csv\"');

    request.details = {
      "copy":{
        "title":process.env.TITLE,
        "description":process.env.DESCRIPTION
      }
    };

    showActiveSubscribers(request,response,'export');
  }
});

// dashboard page:
app.get("/dashboard", function(request, response) {
  request.details = {
    "copy":{
      "title":process.env.TITLE,
      "description":process.env.DESCRIPTION
    }
  };
  request.details.showadmin = false;
  if (request.session.administrator) {
    request.details.showadmin = true;
  } else {
    if (request.query.email == process.env.ADMIN_EMAIL) {
      if (request.query.nonce) {
        // returning from a login email
        // console.log('trying verification on return trip');
        console.log('admin login attempt: ' + request.query.email + ' ' + request.query.nonce);
        var isvalid = validateNonce(process.env.ADMIN_EMAIL,request.query.nonce);
        console.log('validation: ' + isvalid);
        if(isvalid) {
          request.session.administrator = true;
          request.details.showadmin = true;
        }
      } else {
        // requesting a login — send a link
        sendToken(
          process.env.ADMIN_EMAIL,
          'Log in link for ' + process.env.TITLE,
          'Here you go.',
          'To log in just gollow this link. It\'s a one-time link like a password reset, but you never have to worry about a password.',
          'Log in now',
          process.env.URL + 'dashboard'
        );
        request.details.postsend = true;
      }
    }
  }

  response.render('dashboard', request.details);
});

// return from unsubscribe request
app.get("/unsubscribe", function(request, response) {
  // set up variables we'll use when we're done here
  var activeSubs = []; // should be only one, but let's not assume
  var details = {
   copy:{
      title:process.env.TITLE,
      description:process.env.DESCRIPTION
    },
    showerror: true,
    showgoodbye: false
  };
  
  // do we have an email and a nonce? is the email different from the admin? GO TIME
  if (request.query.nonce && request.query.email) {
    // first validate the email and nonce combo
    if(validateNonce(request.query.email,request.query.nonce)) {
      // do unsubscribe
      // TODO: can't get the customers as an iterable array/object 
      // so we wind up in this nested callback upside-down place.
      // Technically we're fine. There should onle be ONE match for
      // any given email, but that doesn't feel like a solid or stable
      // thing to build on. For now it's what we've got. 
      //
      // We currently iterate through every sub for each customer then
      // deal with cancelations at the end to avoid race conditions on a 
      // per-user basis.
      var stream = gateway.customer.search(function (search) {search.email().is(request.query.email);}, function (err, customers) {
        if (err) {
          // error defaults to true
          console.log(err);
          response.render('unsubscribe', details);
        } else {
          //customers.length()
          customers.each(function (err, customer) {
            // found at least that this email oce belonged to a valid customer
            // we'll turn off the error at this point because the customer object
            // wouldn't exist unless they once held a sub
            details.showerror = false;
            // we found at least one subscription, but we don't know yet if any are active.
            // if the nonce is valid and we made it this far it's safe to assume the user 
            // is trying to cancel their subscription, even if they already have, so we show
            // them success that they are indeed unsubscribed no matter what.
            details.showgoodbye = true;
            // loooooooooooooops (credit cards)
            for (var ii = 0, len = customer.creditCards.length; ii < len; ii++) {
              var card = customer.creditCards[ii];
              console.log('CARD: ' + card.bin);
              // more loooooooooooooooooooooooops (subscriptions)
              for (var iii = 0, le = card.subscriptions.length; iii < le; iii++) {
                var subscription = card.subscriptions[iii];

                console.log('SUB: ' + subscription.id);
                console.log('SUB PLAN: ' + subscription.planId);
                console.log('SUB STATUS: ' + subscription.status);

                if (subscription.status == 'Active' &&
                    subscription.planId == process.env.BRAINTREE_PLAN_ID) {
                  // add to subs array
                  activeSubs.push(subscription.id);
                }
              }
            } 

            // okay we've gathered all the subs, now lets act on them
            if (activeSubs.length) {
              // do the cancelation
              for (var iv = 0, len = activeSubs.length; iv < len; iv++) {
                var sub = activeSubs[iv];
                gateway.subscription.cancel(sub.id, function (err, result) {
                  //console.log(JSON.stringify(err));
                  //console.log(JSON.stringify(result));
                  if (err) {
                    details.showerror = true;
                  }
                  response.render('unsubscribe', details);
                });
              }
            } else {
              response.render('unsubscribe', details);
            }
          }); 
        }
      });
    } else {
      details.showerror = true;
      response.render('unsubscribe', details);
      console.log('Email address and nonce not found in database or not a valid combination.');
    }
  } else {
    details.showerror = true;
    response.render('unsubscribe', details);
    console.log('Email address and/or nonce not set.');
  }
});

app.post("/subscribe", function (request, response) {
  var result = gateway.customer.search(function (search) {
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
    
    gateway.customer.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      paymentMethodNonce: request.body.nonce,
      creditCard: {
        options: {
          verifyCard: true
        }
      }
    }, function (err, res) {
      if (res.success) {
        // res.customer.id; // e.g 160923
        gateway.subscription.create({
          paymentMethodToken: res.customer.paymentMethods[0].token,
          planId: process.env.BRAINTREE_PLAN_ID,
          price: finalPrice
        }, function (e, r) {
          // this is where we find out if it worked and send a response
          // 
          // TODO/MAILGUN: send welcome email to [request.body.email]
          //
          console.log(JSON.stringify(r));
          response.sendStatus(200);
        });
      } else {
        // Card processing failed. Send a PaymentRequired 402
        response.sendStatus(402);
      }
    });
  }
});

// create new nonce and send unsubscribe link
app.post("/unsubscribe", function (request, response) {
  sendToken(
    request.body.email,
    'Cancel ' + process.env.TITLE + ' membership',
    'We\'re sorry to see you go.',
    'To cancel membership in ' + process.env.TITLE + ' click here.',
    'Cancel payments',
    process.env.URL + 'unsubscribe'
  );
  response.sendStatus(200);
});



/*********************************************************************
 *
 * GENERAL FUNCTIONS
 * Pretty much just some junk to validate nonces
 *
 *********************************************************************/
async function validateNonce(email,nonce) {
  var valid = false;
  // get a row count for email+nonce+datetime (1 = valid, 0 = not valid)
  await db.get('SELECT Count(*) as count from Nonces WHERE email = "'+email+'" AND nonce = "'+nonce+'" AND created > datetime("now","-24 hours")', function(err, row) {
    if(row.count) {
      valid = true;
    }
    // clean up old rows
    db.run('DELETE FROM Nonces WHERE email = "'+email+'"');
    // return the result
  });
  return valid;
}

function sendToken(emailaddress,subject,intro,instructions,buttontext,url) {
  var nonce = uuid();
  db.serialize(function() {
    db.run('INSERT INTO Nonces (email, nonce) VALUES ("'+emailaddress+'","'+nonce+'")');
  });
  
  prepMailing();
  
  // prep the outgoing email
  var email = {
    body: {
      name: '',
      intro: intro,
      action: {
        instructions: instructions,
        button: {
          color: '#22BC66', // Optional action button color
          text: buttontext,
          link: url + '?email=' + emailaddress + '&nonce=' + nonce
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

  mg.messages().send(data, function (error, body) {
    if (error) {
      console.log('There was an error sending email. Details:');
      console.log(JSON.stringify(body));
    }
  });
}

function showActiveSubscribers(request,response,template) {
  var users = [
    {
      firstName: "firstName",
      lastName: "lastName",
      email: "email"
    }
  ];
  var stream = gateway.subscription.search(function (search) {
    search.planId().is(process.env.BRAINTREE_PLAN_ID);
    search.status().is('Active');
  }, function (err, subs) {
    if (err) {
      request.details.error = 'Braintree error message: ' + err.message;
      response.render('dashboard', request.details);
    } else {
      var len = subs.length();
      var count = 0;
      subs.each(function (err, subscription) {
        if (subscription.transactions[0].customer.email !== '') {
          users.push({
            firstName: subscription.transactions[0].customer.firstName,
            lastName: subscription.transactions[0].customer.lastName,
            email: subscription.transactions[0].customer.email
          });
          console.log(JSON.stringify(users));
          console.log(subscription.transactions[0].customer.email);
        }
        count++;
        if (count == len) {
          request.details.users = users;
          response.render(template, request.details);
        }
      });
    }
  });
}

function prepMailing() {
  // set up mailgun
  mg = mailgun({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});

  // set up mailgen (email templating)
  mailGenerator = new mailgen({
      theme: 'salted',
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
app.listen(process.env.PORT || 8080, () => console.log(
  `Your app is listening on port ${process.env.PORT || 8080}`));