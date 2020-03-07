/********************************************************************
 *
 * CONTROLLERS: index.js ///
 * 
 * This is the main controller file called in app.js. It includes
 * the other controllers and handles the main index file as well 
 * as the /cusomcss route that forwards user-created CSS from
 * the optional config directory.
 *
 *******************************************************************/

// we're going to need this later to detect the optional files
var fs = require('fs');

module.exports = function (app, db) {
  require(__dirname + '/api.js')(app,db);
  require(__dirname + '/dashboard.js')(app,db);
  require(__dirname + '/embed.js')(app,db);
  require(__dirname + '/subscriptions.js')(app,db);

  /****** ROUTE: / *************************************************/
  // The main page. Will show user customized pages if present at
  // /config/views/index.html and if not it will render the default
  // page found at /views/index.html
  app.get(["/","/docs/gettingstarted"], function(request, response) {
    request.details = {
      substationURL: process.env.URL,
      copy: {
        title: process.env.TITLE
      }
    };

    var file = __dirname + '/../config/views/index.html';

    // we're looking for the /config/views/index.html file — if 
    // it's present we use that as our main view, if not we fall
    // back to the default index.html in the /views folder
    try {
      if (fs.existsSync(file) && request.originalUrl == '/') {
        response.render(file, request.details);    
      } else {
        response.render("docs/gettingstarted", request.details);    
      }
    } catch(err) {
      console.error(err);
      response.render("docs/gettingstarted", request.details);    
    }
  });
  
  /****** ROUTE: /customcss *****************************************/
  // Relays the contents of /config/public/css/custom.css (or blank
  // if the file is not present.) This allows a user to place CSS 
  // outsite of the app folders and in the /config folder like the
  // custom homepage. Ultimately they just need to include a style
  // tag pointed at the /customcss endpoint and their file will show.
  app.get("/customcss", function(request, response) {
    var file = __dirname + '/../config/public/css/custom.css';

      // similar to the above, we're looking for the custom.css file
      // in the user's /config/public/css folder. if present we 
      // stream the contents, if not we return an empty file.
      try {
        if (fs.existsSync(file)) {
          var stat = fs.statSync(file);

          response.writeHead(200, {
              'Content-Type': 'text/css',
              'Content-Length': stat.size
          });

          var readStream = fs.createReadStream(file);
          readStream.pipe(response);
        } else {
          response.writeHead(200, {
              'Content-Type': 'text/css'
          });
          response.end();
        }
      } catch(err) {
        console.error(err);
        response.end();
      }
  });
}