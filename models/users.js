module.exports.isAdmin = function(email) {
  // this might look a little silly, but abstracting in case
  // we expand to support multiple admin users
  if (email == process.env.ADMIN_EMAIL) {
    return true;
  } else {
    return false;
  }
};