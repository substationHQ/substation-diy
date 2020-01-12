module.exports = function (app, db) {
  var braintree = require("braintree");
  var gateway = braintree.connect({
    environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY
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

      var auth = require(__dirname + '/../utility/auth.js')(app,db);
      auth.validateNonce(request.query.email, request.query.nonce, function(
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
    var mailer = require(__dirname + '/models/messaging.js')(app,db);
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
}