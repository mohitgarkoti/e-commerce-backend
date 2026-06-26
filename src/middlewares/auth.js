const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

// Protect routes - Verify JWT
const protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Not authorized to access this route. Token missing.'));
  }

  try {
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'garkoti_jwt_secret_key_9988'
    );

    // Fetch user and check if blocked
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(404, 'No user found with this id'));
    }

    if (user.isBlocked) {
      return next(new ApiError(403, 'Your account has been blocked. Contact administration.'));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized to access this route. Token invalid.'));
  }
});

// Grant access to specific roles (e.g. admin)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `User role ${req.user.role} is not authorized to access this resource`
        )
      );
    }
    next();
  };
};

module.exports = { protect, authorize };
