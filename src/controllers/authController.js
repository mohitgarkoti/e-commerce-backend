const https = require('https');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const sendEmail = require('../config/nodemailer');
const crypto = require('crypto');

// Verify Google ID Token natively using Node's https
const verifyGoogleToken = (idToken) => {
  return new Promise((resolve, reject) => {
    https
      .get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error_description) {
              reject(new Error(parsed.error_description));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  let user = await User.findOne({ email });

  if (user) {
    return next(new ApiError(400, 'User already exists with this email'));
  }

  user = await User.create({
    name,
    email,
    password,
  });

  const token = user.getSignedJwtToken();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ApiError(400, 'Please provide an email and password'));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  if (user.isBlocked) {
    return next(new ApiError(403, 'Your account has been blocked. Contact support.'));
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ApiError(401, 'Invalid credentials'));
  }

  const token = user.getSignedJwtToken();

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// @desc    Google Login / Registration
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = catchAsync(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new ApiError(400, 'Google ID token is required'));
  }

  try {
    const googleUser = await verifyGoogleToken(idToken);

    const { email, name, picture, sub: googleId } = googleUser;

    let user = await User.findOne({ email });

    if (user) {
      if (user.isBlocked) {
        return next(new ApiError(403, 'Your account has been blocked. Contact support.'));
      }
      // Link Google ID if not present
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture;
        await user.save();
      }
    } else {
      // Create user
      user = await User.create({
        name: name || 'Google User',
        email,
        googleId,
        avatar: picture || '',
      });
    }

    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'Logged in with Google successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    return next(new ApiError(400, `Google login failed: ${error.message}`));
  }
});

// @desc    Forgot Password - request reset token
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ApiError(404, 'There is no user registered with that email'));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (1 hour)
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

  const message = `
    <h1>Garkoti E-Commerce Password Reset</h1>
    <p>You requested a password reset. Please click on the link below to reset your password:</p>
    <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
    <p>If you did not request this, please ignore this email.</p>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Garkoti E-Commerce - Password Reset Request',
      html: message,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ApiError(500, 'Email could not be sent. Please try again.'));
  }
});

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = catchAsync(async (req, res, next) => {
  const resetToken = req.params.resetToken;

  // Hash token to compare with DB
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError(400, 'Invalid or expired password reset token'));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successful. Please log in with your new password.',
  });
});
