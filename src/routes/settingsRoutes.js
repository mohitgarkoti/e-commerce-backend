const express = require('express');
const {
  getSettings,
  updateSettings,
  updateCMSPage,
  getDashboardAnalytics,
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/', getSettings);

// Admin Configuration Routes
router.put(
  '/',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'websiteLogo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  updateSettings
);

router.put('/cms', protect, authorize('admin'), updateCMSPage);
router.get('/dashboard', protect, authorize('admin'), getDashboardAnalytics);

module.exports = router;
