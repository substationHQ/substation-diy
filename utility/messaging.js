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
          initiateSend(subject,html,emailaddress);
        }
      });
    } else {
      console.log("messaging.sendTransactional: " + err);
    }
  });
};



module.exports.sendMailing = function(
  app,
  subject,
  contents,
  sending
) {
  
  //console.log(contents);
  
  var details = {
    "copy":contents,
    "env": {
      "title":process.env.TITLE,
      "url":process.env.URL
    },
    "unsubscribe":process.env.URL+'unsubscribe',
    "showbutton":false
  };
  
  // prep the outgoing email
  app.render('email', details, function (err, html) {
    if (err) {
      console.log("messaging.sendMailing: " + err);
    } else {
      if (sending) {
        var subscribers = require(__dirname + "/../models/subscribers.js");
        subscribers.getActive(function(err, subs) {
          if (err) {
            console.log("messaging.sendMailing: " + err);
          } else {
            
          }
        });
      } else {
        //console.log(html);
        initiateSend(subject,html,process.env.ADMIN_EMAIL);
      }
    }
  });
};



// set "batch" to true if the to field is an array of email addresses
var initiateSend = function(subject,contents,to,attachments,batch) {
  // we're gonna need this in a second (to generate the plain text version)
  var htmlToText = require('html-to-text');
  var jsdom = require("jsdom");
  var { JSDOM } = jsdom;

  // now we'll use jsdom to get all base64 encoded images and pull them
  // out, replacing them with a cid reference for mailing
  var dom = new JSDOM(contents, { includeNodeLocations: true });
  var images = dom.window.document.querySelectorAll("img");
  var attachments = [];

  images.forEach( 
    function(img,index) {
      if (img.src.substr(0,4) == 'data') {
        // swiped regex from https://stackoverflow.com/questions/11335460/how-do-i-parse-a-data-url-in-node
        // may(?) be worth splitting the img.src string for optimizations later, but that's later.
        var regex = /^data:.+\/(.+);base64,(.*)$/;

        var tmp = img.src;
        
        var matches = img.src.match(regex);
        var ext = matches[1];
        var data = matches[2];
        var buffer = Buffer.from(data, 'base64');
        
        attachments.push(
          new mg.Attachment({
            data: buffer, 
            filename: 'img'+index+'.'+ext,
            contentType: 'image/'+ext
          })
        );
        img.src = 'cid:img'+index+'.'+ext;
      }
    }
  );
  
  var emailBody = dom.serialize();
  var emailText = htmlToText.fromString(emailBody);  
  
  var emailData = {
    'from': process.env.MAILGUN_FROM_EMAIL,
    'subject': subject,
    'text': emailText,
    'html': emailBody,
    'inline': attachments
  };
  
  if (batch) {
     
  } else {
    emailData.to = to;
  }

  mg.messages().send(emailData, function(err, body) {
    if (err) {
      console.log("There was an error sending email. " + err);
    }
  });
}