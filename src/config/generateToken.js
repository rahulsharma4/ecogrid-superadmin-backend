const jwt = require('jsonwebtoken');

const generateToken = (id, passwordHash) => {
  const sig = passwordHash ? passwordHash.substring(passwordHash.length - 10) : '';
  return jwt.sign({ id, sig }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = generateToken;
