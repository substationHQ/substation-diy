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
      response.render("index", request.details);
  });
}