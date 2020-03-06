/********************************************************************
 *
 * UTILITY: server.js ///
 * 
 * The main server. This module sets up requirements, configures the
 * server, and returns a viable express object as app.
 *
 *******************************************************************/

// all base requirements
var express = require("express");
var session = require("express-session");
var FileStore = require('session-file-store')(session);
var csp = require('express-csp-header');
var bodyParser = require("body-parser");
var mustacheExpress = require("mustache-express");
var cors = require('cors');
var helmet = require('helmet');

// make sure sessions don't wind up in the project repo
var fileStoreOptions = {
  "path":__dirname+"/../.data"
};

// instantiate express and do settings
var app = express();
app.use(
  session({
    store: new FileStore(fileStoreOptions),
    secret: process.env.SECURITY_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000
    }
  })
);

// http security measures
app.use(helmet());

// enable CORS for all requests
app.use(cors());

// create a nonce to use with all inline script tags — we 
// store this in the app variable so it's universally available 
// in all controllers for any view.
app.scriptNonce = Buffer.from(process.env.SECURITY_SECRET + Date.now()).toString('base64').substring(0, 12);

// enable basic csp headers
app.use(csp({
  policies: {
    "default-src": ['https:', 'data:', "'unsafe-inline'"],
    "script-src": [
      "'nonce-"+app.scriptNonce+"'",
      "https://cdn.jsdelivr.net/gh/substation-me/",
      "https://js.braintreegateway.com/",
      "https://cdn.quilljs.com/"
    ],
    "object-src": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ['none']
  }
}));

// parse every kind of request automatically — the 24mb limit
// is pretty arbitrary, but it's important it's large enough for
// email attachments encoded over http.
app.use(bodyParser.urlencoded({limit: '24mb', extended: true}))

// directly serve static files from the public folder
app.use(express.static(__dirname + "/../public"));
// mustache-express settings
app.engine("html", mustacheExpress()); // register .html extension
app.disable("view cache"); // <--------------------------------------------------- COMMENT OUT IN PRODUCTION
app.set("view engine", "html"); // set the engine
app.set("views", __dirname + "/../views"); // point at our views

// force SSL!
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

// export the express object 
module.exports = app;