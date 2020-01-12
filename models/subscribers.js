module.exports = function(app, db) {
  var braintree = require("braintree");
  var gateway = braintree.connect({
    environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY
  });

  /*******************************************************************
   *
   * BEGIN OBJECT FUNCTIONS
   *
   *******************************************************************/
  var add = function() {};

  var getActive = function(callback) {
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
            if (count == len) {
              callback(null, users);
            } else {
              callback("No active subscribers found.", null);
            }
          });
        }
      }
    );
  };

  var remove = function() {};

  var validate = function() {};
};
