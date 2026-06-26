const express = require('express');
const {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  getMyOrders,
  getOrder,
  downloadInvoice,
  adminGetOrders,
  adminUpdateStatus,
  adminUpdateTracking,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/', (req, res, next) => {
  // Optional protection middleware helper
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  next();
}, createOrder);

router.post('/verify', verifyPayment);
router.post('/webhook', razorpayWebhook);
router.get('/my-orders', protect, getMyOrders);
router.get('/:id/invoice', downloadInvoice);

router.get('/:id', (req, res, next) => {
  if (req.headers.authorization) {
    return protect(req, res, next);
  }
  next();
}, getOrder);

// Admin Routes
router.get('/', protect, authorize('admin'), adminGetOrders);
router.put('/:id/status', protect, authorize('admin'), adminUpdateStatus);
router.put('/:id/tracking', protect, authorize('admin'), adminUpdateTracking);

module.exports = router;
