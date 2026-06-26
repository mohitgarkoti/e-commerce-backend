const express = require('express');
const {
  applyCoupon,
  removeCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/couponController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/apply', protect, applyCoupon);
router.post('/remove', protect, removeCoupon);

// Get available coupons (Public gets active, Admin gets all)
router.get('/', (req, res, next) => {
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  next();
}, getCoupons);

// Admin Routes
router.post('/', protect, authorize('admin'), createCoupon);
router.put('/:id', protect, authorize('admin'), updateCoupon);
router.delete('/:id', protect, authorize('admin'), deleteCoupon);

module.exports = router;
