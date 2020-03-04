/********************************************************************
 *
 * CONTROLLERS: embed.js ///
 * 
 * Just the one endpoint for now, this controller renders the 
 * interface for the sign-up/payment/cancel widget. Call this 
 * endpoint and it renders out the HTML ready for an iframe, and
 * including lodge embed code — so that iframe will resize 
 * dynamically inside of a container on the embedding page if it
 * uses lodge too. 
 *
 *******************************************************************/

module.exports = function (app, db) {
  /****** ROUTE: /embed ********************************************/
  app.get("/embed", function(request, response) {
    // set up braintree token for frontend javascript
    var braintree = require("braintree");
    var gateway = braintree.connect({
      environment: braintree.Environment[process.env.BRAINTREE_ENVIRONMENT],
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY
    });
    // get a token, wait, then render the page
    gateway.clientToken.generate({ version: 3 }, function(err, res) {
      if (err) {
        console.log(err);
      } else {
        // got the token so now we just need to set a few parameters
        
        var sandboxed = false; // default to live environment
        if (process.env.BRAINTREE_ENVIRONMENT == "Sandbox") {
          // sandbox has been set to true in the .env file so 
          // we set it true here
          sandboxed = true;
        }
        // the rest is just filling in details for the view
        request.details = {
          braintree: {
            clientToken: res.clientToken,
            planId: process.env.BRAINTREE_PLAN_ID,
            minimumCost: process.env.BRAINTREE_MINIMUM_COST
          },
          copy: {
            title: process.env.TITLE
          },
          scriptNonce: app.scriptNonce,
          sandboxed: sandboxed
        };
      }
      response.render("embed", request.details);
    });
  });
}