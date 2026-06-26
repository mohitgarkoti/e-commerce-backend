const express = require('express');
const {
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  toggleBlockUser,
} = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// Admin Routes
router.get('/', protect, authorize('admin'), getAllUsers);
router.put('/:id/block', protect, authorize('admin'), toggleBlockUser);

module.exports = router;
