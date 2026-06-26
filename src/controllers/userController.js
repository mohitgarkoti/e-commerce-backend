const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc    Get current logged in user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json(new ApiResponse(200, user, 'Profile fetched successfully'));
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { name, avatar } = req.body;
  
  const user = await User.findById(req.user.id);
  if (name) user.name = name;
  if (avatar) user.avatar = avatar;

  await user.save();

  res.status(200).json(new ApiResponse(200, {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar
  }, 'Profile updated successfully'));
});

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ApiError(400, 'Please enter current and new passwords'));
  }

  // Get user with password selected
  const user = await User.findById(req.user.id).select('+password');

  if (user.googleId && !user.password) {
    return next(new ApiError(400, 'Google users cannot change passwords directly. Use OAuth login.'));
  }

  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    return next(new ApiError(400, 'Current password is incorrect'));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password updated successfully'));
});

// ================= ADMIN CONTROLLERS =================

// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({ role: 'customer' }).sort('-createdAt');
  res.status(200).json(new ApiResponse(200, users, 'Customers list fetched successfully'));
});

// @desc    Block / Unblock customer
// @route   PUT /api/users/:id/block
// @access  Private/Admin
exports.toggleBlockUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (user.role === 'admin') {
    return next(new ApiError(400, 'Cannot block administrative users'));
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  const statusMsg = user.isBlocked ? 'blocked' : 'unblocked';
  res.status(200).json(new ApiResponse(200, user, `Customer successfully ${statusMsg}`));
});
