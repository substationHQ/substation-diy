/********************************************************************
 *
 * CONTROLLERS: api.js ///
 * 
 * Work in progress.
 *
 *******************************************************************/

module.exports = function(app, db) {
  app.get("/api/v:version/subscribers/validate", function(request, response) {
    request.details = {
      "version": request.params.version
    }
    response.render("api/v"+request.params.version+"/subscribers/validate", request.details);
  });
};
