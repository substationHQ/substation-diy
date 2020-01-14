module.exports = function (app, db) {
  require(__dirname + '/dashboard.js')(app,db);
  require(__dirname + '/subscriptions.js')(app,db);

  // serve domain root:
  app.get("/", function(request, response) {
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
}