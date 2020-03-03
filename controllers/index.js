var fs = require('fs');

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
  
  app.get("/customcss", function(request, response) {
    var file = __dirname + '/../config/public/css/custom.css';

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
          response.end();
        }
      } catch(err) {
        console.error(err);
        response.end();
      }
  });
}