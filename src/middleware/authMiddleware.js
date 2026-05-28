const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id);

      if (!req.user || req.user.isDeleted || req.user.status === 'inactive') {
        return res.status(401).json({ message: 'Not authorized, user account is inactive or deleted' });
      }

      // Check if password has been changed/reset
      if (decoded.sig) {
        const currentSig = req.user.password ? req.user.password.substring(req.user.password.length - 10) : '';
        if (decoded.sig !== currentSig) {
          return res.status(401).json({ message: 'Not authorized, password has been changed. Please login again.' });
        }
      }

      // Remove password hash from memory
      req.user.password = undefined;

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

const superadmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as a superadmin' });
  }
};

module.exports = { protect, admin, superadmin };
