module.exports = function (app, db) {
  require(__dirname + '/api.js')(app,db);
  require(__dirname + '/dashboard.js')(app,db);
  require(__dirname + '/embed.js')(app,db);
  require(__dirname + '/subscriptions.js')(app,db);

  // serve domain root:
  app.get("/", function(request, response) {
      request.details = {
        copy: {
          title: process.env.TITLE
        }
      };
    
      var fs = require('fs')
      var file = __dirname + '/../config/views/index.html';

      try {
        if (fs.existsSync(file)) {
          response.render(file, request.details);    
        } else {
          response.render("index", request.details);    
        }
      } catch(err) {
        console.error(err);
        response.render("index", request.details);    
      }
  });
}