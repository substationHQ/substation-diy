module.exports.getAdminUsers = function() {
  var admin = process.env.ADMIN_EMAIL;
  if (admin.charAt(0) != '"' && admin.charAt(0) != '[') {
      admin = '"' + admin + '"';
  }
  try {
    admin = JSON.parse(admin);
  } catch(err) {
    console.error(err)
  }
  if (typeof admin === 'string') {
    // single user — throw it into a single element array for consistency
    return [admin];
  } else {
    // multiple users — return the array
    return admin;
  }
}

module.exports.isAdmin = function(email) {
  // will determine if the given email is either equal to the 
  // ADMIN_EMAIL environment variable (if set as a string) or 
  // if it is present in ADMIN_EMAIL (if set as an array)
  var admin = module.exports.getAdminUsers();
  if (admin.includes(email)) {
    return true;
  } else {
    return false; 
  }
};