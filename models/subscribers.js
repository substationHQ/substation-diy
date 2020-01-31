var braintree = require("braintree");
var gateway = braintree.connect({
  environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

/*******************************************************************
 *
 * BEGIN FUNCTIONS
 *
 *******************************************************************/
module.exports.add = function(
  email,
  firstName,
  lastName,
  nonce,
  amount,
  callback
) {
  var result = gateway.customer.search(function(search) {
    search.email().is(email);
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
    if (amount > finalPrice) {
      finalPrice = amount;
    }

    gateway.customer.create(
      {
        firstName: firstName,
        lastName: lastName,
        email: email,
        paymentMethodNonce: nonce,
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
              // console.log(JSON.stringify(r));
              callback(null, 200);
            }
          );
        } else {
          // Card processing failed. Send a PaymentRequired 402
          // TODO: better error handling between validation and form
          /*
          
            This shows we need to encode plus signs, but also we need 
            a fallback failure for any validation errors
            
            Related, but tangent: the form needs a progress indicator
          
            ErrorResponse {
              errors: ValidationErrorsCollection {
                validationErrors: {},
                errorCollections: { customer: [ValidationErrorsCollection] }
              },
              params: {
                customer: {
                  firstName: 'Jesse',
                  lastName: 'James',
                  email: 'jessevondoom heresanothertest@gmail.com',
                  paymentMethodNonce: 'tokencc_bc_yw3dp2_yff7gj_y3sbmy_77kstx_7z4',
                  creditCard: [Object]
                }
              },
              message: 'Email is an invalid format.',
              success: false
            }
          */
          console.log(res);
          callback(402, null);
        }
      }
    );
  }
};

module.exports.getActive = function(callback) {
  // subscribers.getActive(function(err, subs){...});
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
        callback(err.message, null);
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
          // check if we've read the wole stream. if so, output the CSV
          if (count == len) {
            if (count > 0) {
              callback(null, users);
            } else {
              callback("No active subscribers found.", null);
            }
          }
        });
      }
    }
  );
};

module.exports.remove = function(email, callback) {
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
      search.email().is(email);
    },
    function(err, customers) {
      if (err) {
        callback(err, null);
      } else {
        console.log("total customers: " + customers.length());
        customers.each(function(err, customer) {
          // found at least that this email once belonged to a valid customer

          if (err) {
            callback(err, null);
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
                  gateway.subscription.cancel(subscription.id, function(
                    err,
                    result
                  ) {
                    callback(null, result);
                  });
                } else {
                  console.log("subscription already canceled");
                  // show the success message — this is a funny situation as there's a time
                  // where the user can cancel their sub but still be seen as 'active' until
                  // their subscription period ends. better to reassure the user than give a
                  // false error message if they're trying a second time...
                  callback(null, true);
                }
              }
            }
          }
        });
      }
    }
  );
};

module.exports.validate = function(email) {
  // TODO: check email address against active subscribers to
  //       validate the subscriber
};
