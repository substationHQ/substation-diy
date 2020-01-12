var express = require("express");
var session = require("express-session");
var bodyParser = require("body-parser");
var mustacheExpress = require("mustache-express");

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
app.use(express.static(__dirname + "/../public"));
// mustache-express settings
app.engine("html", mustacheExpress()); // register .html extension
app.disable("view cache"); // <--------------------------------------------------- COMMENT OUT IN PRODUCTION
app.set("view engine", "html"); // set the engine
app.set("views", __dirname + "/../views"); // point at our views

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


module.exports = app;