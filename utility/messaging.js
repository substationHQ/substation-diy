/********************************************************************
 *
 * UTILITY: messaging.js ///
 * 
 * Currently this module handles individual and list mailings, 
 * interfacing with the MailGun API. It's pretty straightforward
 * despite the length — we use more lines than seem necessary
 * because we allow for user-customizable views in the /config
 * directory. All of the following will overrule their counterpart
 * views:
 * 
 * /config/views/email.html (list mail base template)
 * /config/views/messages/login.html (click to login w/ nonce)
 * /config/views/messages/unsubscribe.html (confirm unsubscription)
 * /config/views/messages/welcome.html (new signup welcome message)
 *
 * It's best practice for users to create these override files
 * rather than directly editing defaults — this allows for future 
 * updates to the core scripts without losing any customizations.
 *
 *******************************************************************/

var fs = require('fs');
//var mailgen = require("mailgen");
var mailgun = require("mailgun-js");

// set up mailgun
var mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});


/****** FUNCTION: messaging.sendMessage() **************************/
// Handles transactional messaging for unsubscribes, logins, and 
// new user welcome messages. Expects the following parameters:
// (object)   app (pass in the main express object)
// (string)   email
// (string)   subject
// (string)   title
// (string)   message (which message? accepts: login, usubscribe, or welcome)
// (string)   buttontext (for the "click here...")
// (string)   url (if not set there will be no "click here..." button)
module.exports.sendMessage = function(
  app,
  email,
  subject,
  title,
  message,
  buttontext,
  url,
  redirecturl
) {
  var nonce = '';
  if (message == 'login' || message == 'unsubscribe') {
    // TODO: CENTRALIZE NONCE GEN IN auth.js
    // enable basic uuids for a little later
    var { v1: uuidv1 } = require('uuid');
    var db = require(__dirname + "/database.js");
    // quickly generate a nonce
    nonce = uuidv1();
    // assume we need the return, so store it in db
    db.serialize(function() {
      db.run(
        'INSERT INTO Nonces (email, nonce) VALUES ("' +
          email +
          '","' +
          nonce +
          '")'
      );
    });
  }
  
  // set details for the view
  var details = {
    "title":title,
    "copy":"",
    "showbutton":true,
    "env": {
      "title":process.env.TITLE,
      "url":process.env.URL
    },
    "unsubscribe":process.env.URL+'unsubscribe'
  };
  // give a proper false to the email template for view if statements
  // set the button url/copy where needed
  if (!url) {
    details.showbutton = false;
  } else {
    details.button = {
      "url":url + "?email=" + email + "&nonce=" + nonce,
      "copy":buttontext
    };
  }
  if (details.showbutton && redirecturl) {
    details.button.url += "&redirect=" + redirecturl;
  }
  
  // select the correct view and prep the outgoing email
  // we start by defining where the user customized version in /config
  // woud be then see if it exists.
  var file = __dirname + '/../config/views/messages/' + message + '.html';
  try {
    if (!fs.existsSync(file)) {
      // not there? use the default!
      file = __dirname + '/../views/messages/' + message + '.html';  
    }
  } catch(err) {
    // weird error? use the default!
    console.error(err);
    file = __dirname + '/../views/messages/' + message + '.html';
  }
  fs.readFile(file, 'utf8', function(err, contents) {
    if (contents) {
      // so we got the message file, now we need to stuff it into
      // the email wrapper. that means more checks and the same 
      // basic process again.
      details.copy = contents;
      var template = __dirname + '/../config/views/email.html';
      try {
        if (!fs.existsSync(template)) {
          // no custom email view, so use the default one!
          template = 'email';  
        }
      } catch(err) {
        // error. use the default view.
        console.error(err);
        template = 'email';
      }
      // render the contents with our chosen email view
      app.render(template, details, function (err, html) {
        if (err) {
          console.log("messaging.sendTransactional: " + err);
        } else {
          // rendered (yay!) now initiate the actual send
          initiateSend(subject,html,email);
        }
      });
    } else {
      // spit out the dang error and get sad
      console.log("messaging.sendTransactional: " + err);
    }
  });
};

/****** FUNCTION: messaging.sendMailing() **************************/
// Handles transactional messaging for unsubscribes, logins, and 
// new user welcome messages. Expects the following parameters:
// (object)   app (pass in the main express object)
// (string)   subject
// (string)   contents
// (boolean)  sending (true: do a full list send, false: test send)
module.exports.sendMailing = function(
  app,
  subject,
  contents,
  sending
) {
  // set the details we'll pass to the view
  var details = {
    "copy":contents,
    "env": {
      "title":process.env.TITLE,
      "url":process.env.URL
    },
    "unsubscribe":process.env.URL+'unsubscribe',
    "showbutton":false
  };
  
  // we need to coose the correct view and prep the outgoing email
  var email = __dirname + '/../config/views/email.html';
  try {
    if (!fs.existsSync(email)) {
      // user customized template not found, use the default view
      email = 'email';  
    }
  } catch(err) {
    // error. use default view.
    console.error(err);
    email = 'email';
  }
  app.render(email, details, function (err, html) {
    if (err) {
      console.log("messaging.sendMailing: " + err);
    } else {
      if (sending) {
        // okay we're sending to the full list. unleash the kraken.
        initiateSend(subject,html,false,true);
      } else {
        // just a test, so we get all admin user emails and send
        // a test to them instead of the big list
        var users = require(__dirname + "/../models/users.js");
        var admins = users.getAdminUsers();
        admins.forEach(function(admin){
          initiateSend(subject,html,admin);
        });
      }
    }
  });
};

/****** FUNCTION: messaging.sendMailing() **************************/
// Handles transactional messaging for unsubscribes, logins, and 
// new user welcome messages. Expects the following parameters:
// (string)       subject
// (string)       contents
// (string/array) to
// (boolean)      batch (true: do a full list send — when true to should be an array)
var initiateSend = function(subject,contents,to,batch) {
  // we're gonna need this in a second (to generate the plain text version)
  var htmlToText = require('html-to-text');

  // now we'll use jsdom to get all base64 encoded images and pull them
  // out, replacing them with a cid reference for mailing
  var jsdom = require("jsdom");
  var { JSDOM } = jsdom;
  var dom = new JSDOM(contents, { includeNodeLocations: true });
  var images = dom.window.document.querySelectorAll("img");
  var attachments = [];

  // get all the images, encode them, and turn them into cid references
  images.forEach( 
    async function(img,index) {
      if (img.src.substr(0,4) == 'data') {
        // we've got a data: URL base64 encoded image, so let's get to work
        // swiped regex from https://stackoverflow.com/questions/11335460/how-do-i-parse-a-data-url-in-node
        // may(?) be worth splitting the img.src string for optimizations later, but that's later.
        var regex = /^data:.+\/(.+);base64,(.*)$/;

        // capture the image source, info about it, and decode from base64
        var tmp = img.src;
        var matches = img.src.match(regex);
        var ext = matches[1];
        var data = matches[2];
        var buffer = Buffer.from(data, 'base64');
        
        // add the image to our attachments array
        attachments.push(
          new mg.Attachment({
            data: buffer, 
            filename: 'img'+index+'.'+ext,
            contentType: 'image/'+ext
          })
        );
        // now change the original image's src to match out cid reference
        img.src = 'cid:img'+index+'.'+ext;
      }
    }
  );
  
  // serialize the emailBody to reconstruct content markup
  // create a text-only version from the html
  var emailBody = dom.serialize();
  var emailText = htmlToText.fromString(emailBody);  
  
  // gather all the parameters we'll pass to MailGun
  var emailData = {
    'from': process.env.MAILGUN_FROM_EMAIL,
    'subject': subject,
    'text': emailText,
    'html': emailBody,
    'inline': attachments
  };
  
  if (batch) {
    // when batch is true we're sending to the whole list
    var toArray = [];
    var toVars = {};
    // get the current members then send them batched as an
    // on-the-fly email list at MailGun
    //
    // TODO: this has a 1000 email rate limit — we ultimately need
    //       to chunk out the toArray and do multiple requests for 
    //       every group of one thousand.
    var subscribers = require(__dirname + "/../models/subscribers.js");
    subscribers.getActive(function(err, subs) {
      if (err) {
        console.log("error getting subscribers");
      } else {
        subs.forEach(function(s){
          toArray.push(s.email);
          toVars[s.email] = {
            'firstName':s.firstName,
            'lastName':s.lastName
          }
        });
        // we set the array of addresses as the to field
        emailData['to'] = toArray;
        // and they all need to have recipient variables set
        // at MailGun in order to be sent as a batched send with
        // each recipient only seeing it addressed to them (like
        // any proper mailing list. GTFO BCC.)
        emailData['recipient-variables'] = toVars;
        mg.messages().send(emailData, function(err, body) {
          if (err) {
            console.log("There was an error sending email. " + err);
          }
        });
      }
    });
  } else {
    // smaller test send to the designated (admin email addresses) to param
    emailData.to = to;
    mg.messages().send(emailData, function(err, body) {
    if (err) {
      console.log("There was an error sending email. " + err);
    }
  });
  }
}