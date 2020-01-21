var db = require(__dirname + "/database.js");
//var mailgen = require("mailgen");
var mailgun = require("mailgun-js");

// set up mailgun
var mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});


/*******************************************************************
 *
 * BEGIN FUNCTIONS
 *
 *******************************************************************/

module.exports.sendMessage = function(
  app,
  emailaddress,
  subject,
  title,
  message,
  buttontext,
  url
) {
  var uuid = require("uuid/v1");
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
  
  var details = {
    "title":title,
    "copy":"",
    "showbutton":true,
    "button": {
      "url":url + "?email=" + emailaddress + "&nonce=" + nonce,
      "copy":buttontext
    },
    "env": {
      "title":process.env.TITLE,
      "url":process.env.URL
    },
    "unsubscribe":process.env.URL+'unsubscribe'
  };
  // cleanup to give a proper false to the email template for if statement
  if (!url) {
    details.showbutton = false;
  }
  
  // prep the outgoing email
  var fs = require('fs');
  fs.readFile(__dirname + '/../views/messages/' + message + '.html', 'utf8', function(err, contents) {
    if (contents) {
      details.copy = contents;
      app.render('email', details, function (err, html) {
        if (err) {
          console.log("messaging.sendTransactional: " + err);
        } else {
          // we're gonna need this in a second (to generate the plain text version)
          var htmlToText = require('html-to-text');

          var emailBody = html;
          var emailText = htmlToText.fromString(html);

          var emailData = {
            from: process.env.MAILGUN_FROM_EMAIL,
            to: emailaddress,
            subject: subject,
            text: emailText,
            html: emailBody
          };

          mg.messages().send(emailData, function(err, body) {
            if (err) {
              console.log("There was an error sending email.");
            }
          });
        }
      });
    } else {
      console.log("messaging.sendTransactional: " + err);
    }
  });
};
