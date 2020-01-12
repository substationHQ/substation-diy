module.exports = function(app, db) {
  var prepMailing = function() {
    var mailgen = require("mailgen");
    var mailgun = require("mailgun-js");

    // set up mailgun
    var mg = mailgun({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN
    });

    // set up mailgen (email templating)
    var mailGenerator = new mailgen({
      theme: "salted",
      product: {
        // Appears in header & footer of e-mails
        name: process.env.TITLE,
        link: process.env.URL
      }
    });
  }
  
  var sendToken = function(
    emailaddress,
    subject,
    intro,
    instructions,
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

    var mailer = prepMailing();

    // prep the outgoing email
    var email = {
      body: {
        name: "",
        intro: intro,
        action: {
          instructions: instructions,
          button: {
            color: "#22BC66", // Optional action button color
            text: buttontext,
            link: url + "?email=" + emailaddress + "&nonce=" + nonce
          }
        }
      }
    };
    var emailBody = mailer.mailGenerator.generate(email); // html version of the email
    var emailText = mailer.mailGenerator.generatePlaintext(email); // plain text version of the email

    var data = {
      from: process.env.MAILGUN_FROM_EMAIL,
      to: emailaddress,
      subject: subject,
      text: emailText,
      html: emailBody
    };

    mailer.mg.messages().send(data, function(error, body) {
      if (error) {
        console.log("There was an error sending email. Details:");
        console.log(JSON.stringify(body));
      }
    });
  }
}