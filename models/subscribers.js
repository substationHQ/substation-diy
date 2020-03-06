/********************************************************************
 *
 * MODELS: subscribers.js ///
 * 
 * Substation's DIY core is (mostly) database-less. Subscriber
 * information is all stored in Braintree's secure PCI vault. This
 * leads to security and portability, but also makes for a funny
 * data model in general.
 *
 * The subscribers model deals with the Braintree API calls to 
 * add and remove members, as well as pulling broad membership info.
 *
 *******************************************************************/

// set up the Braintree environment
var braintree = require("braintree");
var gateway = braintree.connect({
  environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});


/****** FUNCTION: subscribers.add() *********************************/
// Adds a new member, expecting the following inputs:
// (string)   email
// (string)   firstName
// (string)   lastName
// (string)   nonce [obtained from Braintree checkout form]
// (string)   amount [monthly amount paid]
// (function) callback(err,result)
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
    //
    // DATA MODEL (FROM API) REMINDER:
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
    // make sure it's at least the defined minimum
    if (amount > finalPrice) {
      finalPrice = amount;
    }
    // add the user
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
      // define callback
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
          // SAMPLE ERROR:
          /*          
            ErrorResponse {
              errors: ValidationErrorsCollection {
                validationErrors: {},
                errorCollections: { customer: [ValidationErrorsCollection] }
              },
              params: {
                customer: {
                  firstName: 'Jesse',
                  lastName: 'von Doom',
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
          // 402 "Payment required"
          callback(402, null);
        }
      }
    );
  }
};

/****** FUNCTION: subscribers.getTotals() ***************************/
// Gets total member count and upcoming monthly total subscription
// values. The only parameter is its callback.
// (function) callback(err,result)
module.exports.getTotals = function(callback) {
  var stream = gateway.subscription.search(
    // first we look for all active members by plan ID
    function(search) {
      search.planId().is(process.env.BRAINTREE_PLAN_ID);
      search.status().is("Active");
    },
    function(err, subs) {
      if (err) {
        callback(err.message, null);
      } else {
        // set up our totals for counting
        var totals = {
          "value": 0,
          "members":0
        };
        var len = subs.length();
        // we need this count to know where we are in the stream —
        // feels a little janky but less janky than moving to an 
        // async/await structure
        var count = 0;
        subs.each(function(err, subscription) {
          // loop all viable entries. the check for a blank email is 
          // likely unnecessary, but a few blanks snuck in during 
          // testing so it clearly can't hurt. we've added some 
          // checks when setting things up, but left in the check
          // against blank email addresses here because who cares.
          if (subscription.transactions[0].customer.email !== "") {
            totals.members = totals.members+1;
            totals.value = Math.round(totals.value + parseFloat(subscription.nextBillingPeriodAmount));
          }
          count++;
          // check if we've read the whole stream. if so, output the CSV
          if (count == len) {
            if (count > 0) {
              callback(null,totals);
            } else {
              callback("Not found", null);
            }
          }
        });
      }
    }
  );
}

/****** FUNCTION: subscribers.getActive() ***************************/
// Gets all active members from the Braintree API with a callback.
// (function) callback(err,result)
module.exports.getActive = function(callback) {
  // set up a return array of members
  var users = [
    {
      firstName: "firstName",
      lastName: "lastName",
      email: "email"
    }
  ];
  // request all the active users (all paid up and current — this will
  // include users who have canceled but are paid up until the end of
  // the current pay period)
  var stream = gateway.subscription.search(
    function(search) {
      search.planId().is(process.env.BRAINTREE_PLAN_ID);
      search.status().is("Active");
    },
    function(err, subs) {
      if (err) {
        callback(err.message, null);
      } else {
        // we found some active members — set up our count so we can
        // navigate the stream and output when finished.
        var len = subs.length();
        var count = 0;
        subs.each(function(err, subscription) {
          if (subscription.transactions[0].customer.email !== "") {
            // looks like a viable member — push their first name, 
            // last name, and email address into the return array
            users.push({
              firstName: subscription.transactions[0].customer.firstName,
              lastName: subscription.transactions[0].customer.lastName,
              email: subscription.transactions[0].customer.email
            });
          }
          count++;
          // check if we've read the whole stream. if so, callback
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

/****** FUNCTION: subscribers.remove() ******************************/
// Cancels a member subscription. The member remains active until
// their current pay period ends. Expects email and callback.
// (string)   email
// (function) callback(err,result)
module.exports.remove = function(email, callback) {
  // TODO: can't get the customers as an iterable array/object
  // so we wind up in this nested loopsy upside-down stream place.
  // Technically we're fine. There should only be ONE match for
  // any given email, but that doesn't feel like a solid or stable
  // thing to build on. For now it's what we've got.
  //
  // We currently iterate through every sub for each customer match, 
  // then deal with cancelations at the end to avoid race conditions 
  // on a per-user basis.
  var stream = gateway.customer.search(
    function(search) {
      search.email().is(email);
    },
    function(err, customers) {
      if (err) {
        callback(err, null);
      } else {
        customers.each(function(err, customer) {
          if (err) {
            callback(err, null);
          } else {
            // we found at least one subscription, but we don't know yet if 
            // any are active. if the nonce is valid and we made it this far 
            // it's safe to assume the user is trying to cancel their 
            // subscription, even if they already have, so we show them 
            // success that they are indeed unsubscribed no matter what.

            // loooooooooooooops (credit cards) — subscriptions are actually
            // stored per card in Braintree so we gotta keep digging...
            for (
              var ii = 0, len = customer.creditCards.length;
              ii < len;
              ii++
            ) {
              var card = customer.creditCards[ii];
              // more loooooooooooooooooooooooops (subscriptions)
              for (
                var iii = 0, le = card.subscriptions.length;
                iii < le;
                iii++
              ) {
                var subscription = card.subscriptions[iii];
                // sweet lord we can finally check to make sure the sub is
                // active and the plan matches the plan in the substation .env
                if (
                  subscription.status == "Active" &&
                  subscription.planId == process.env.BRAINTREE_PLAN_ID
                ) {
                  // finally we can call the actual cancel action
                  gateway.subscription.cancel(subscription.id, function(
                    err,
                    result
                  ) {
                    // it was a success! 
                    callback(null, result);
                  });
                } else {
                  // subscription already canceled
                  //
                  // show the success message — this is a funny situation 
                  // as there's a time where the user can cancel their sub 
                  // but still be seen as 'active' until their subscription 
                  // period ends. better to reassure the user than give a
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

/****** FUNCTION: subscribers.validate() ****************************/
// Placeholder. Want to be able to say "does this email belong to an
// active member?" and return a boolean.
module.exports.validate = function(email, callback) {
  // TODO: check email address against active subscribers to
  //       validate the subscriber email
};
