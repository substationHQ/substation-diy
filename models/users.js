/********************************************************************
 *
 * MODELS: users.js ///
 * 
 * This is a bit more simple than the subscribers model, because 
 * we're dealing with a far smaller range of options.
 *
 * The user model deals with admin users of the substation app, as 
 * opposed to members of the club/subscription
 *
 *******************************************************************/


/****** FUNCTION: users.getAdminUsers() ****************************/
// Parses the .env file and returns an array of one or more email
// addresses that are valid admin users. There's nothing async here
// so no callback, just a simple return.
//
// Potential .env admin formats:
// ADMIN_EMAIL=person@domain.com
// ADMIN_EMAIL=$'["person@domain.com","anotherperson@domain.com"]'
//
// For those unfamiliar with .env files, the plain text (no quotes)
// string up top is a basic string that can work for a single admin
// email. To add multiple admin users we need to pop in some JSON,
// which means adding a string literal that can include quotes. 
// For that we use the $'' format, hence the difference in format. 
module.exports.getAdminUsers = function() {
  var admin = process.env.ADMIN_EMAIL;
  if (admin.charAt(0) != '"' && admin.charAt(0) != '[') {
    // this is just a basic string, so we wrap it in quotes so it
    // will parse as valid JSON
    admin = '"' + admin + '"';
  }
  try {
    // parse the admin string as JSON
    admin = JSON.parse(admin);
  } catch(err) {
    console.error(err)
  }
  // parsed okay — now we can check if it's a string or an array
  if (typeof admin === 'string') {
    // single user string, so we throw it into a single element 
    // array for consistency in the return
    return [admin];
  } else {
    // multiple users — just return the array
    return admin;
  }
}

/****** FUNCTION: users.isAdmin() **********************************/
// Checks an email address against the defined admin user(s) and
// validates that the email should have admin priviledges.
// 
// Nothing asynchronous about this function so it's a basic return
// function that expects only one parameter:
// (string)   email
module.exports.isAdmin = function(email) {
  var admin = module.exports.getAdminUsers();
  if (admin.includes(email)) {
    return true;
  } else {
    return false; 
  }
};