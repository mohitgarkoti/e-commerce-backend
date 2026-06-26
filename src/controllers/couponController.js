const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc    Apply coupon code to cart
// @route   POST /api/coupons/apply
// @access  Private
exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new ApiError(400, 'Coupon code is required'));
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });

  if (!coupon || !coupon.isValid()) {
    return next(new ApiError(400, 'Coupon is invalid, expired, or has reached its usage limit'));
  }

  // Fetch user cart
  const cart = await Cart.findOne({ user: req.user.id }).populate({
    path: 'items.product',
    select: 'price salePrice isActive',
  });

  if (!cart || cart.items.length === 0) {
    return next(new ApiError(400, 'Your cart is empty. Cannot apply coupon.'));
  }

  // Calculate cart subtotal
  let subtotal = 0;
  cart.items.forEach((item) => {
    if (item.product && item.product.isActive) {
      const price = item.product.salePrice && item.product.salePrice < item.product.price
        ? item.product.salePrice
        : item.product.price;
      subtotal += price * item.quantity;
    }
  });

  // Calculate discount value
  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (subtotal * coupon.discountValue) / 100;
  } else {
    discount = coupon.discountValue;
  }

  if (discount > subtotal) {
    discount = subtotal; // discount cannot exceed cart total
  }

  cart.couponCode = coupon.code;
  cart.discount = Math.round(discount * 100) / 100;
  await cart.save();

  // Populate fully for output
  const populatedCart = await Cart.findOne({ user: req.user.id }).populate({
    path: 'items.product',
    select: 'name slug sku price salePrice images quantity stockStatus isActive',
  });

  res.status(200).json(new ApiResponse(200, populatedCart, `Coupon ${coupon.code} applied successfully`));
});

// @desc    Remove coupon from cart
// @route   POST /api/coupons/remove
// @access  Private
exports.removeCoupon = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate({
    path: 'items.product',
    select: 'name slug sku price salePrice images quantity stockStatus isActive',
  });

  if (!cart) {
    return next(new ApiError(404, 'Cart not found'));
  }

  cart.couponCode = null;
  cart.discount = 0;
  await cart.save();

  res.status(200).json(new ApiResponse(200, cart, 'Coupon removed successfully'));
});

// ================= ADMIN CONTROLLERS =================

// @desc    Get all coupons (Admin get all, Public get active only)
// @route   GET /api/coupons
// @access  Public / Admin
exports.getCoupons = catchAsync(async (req, res, next) => {
  const filter = {};

  if (!req.user || req.user.role !== 'admin') {
    filter.active = true;
    filter.expiryDate = { $gt: new Date() };
  }

  const coupons = await Coupon.find(filter).sort('-createdAt');
  res.status(200).json(new ApiResponse(200, coupons, 'Coupons list fetched successfully'));
});

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private/Admin
exports.createCoupon = catchAsync(async (req, res, next) => {
  const { code, discountType, discountValue, expiryDate, usageLimit } = req.body;

  if (!code || !discountType || !discountValue || !expiryDate) {
    return next(new ApiError(400, 'Code, discount type, value, and expiry date are required'));
  }

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    return next(new ApiError(400, 'A coupon with this code already exists'));
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    discountType,
    discountValue: Number(discountValue),
    expiryDate: new Date(expiryDate),
    usageLimit: usageLimit ? Number(usageLimit) : undefined,
  });

  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created successfully'));
});

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
exports.updateCoupon = catchAsync(async (req, res, next) => {
  const { discountType, discountValue, expiryDate, usageLimit, active } = req.body;
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new ApiError(404, 'Coupon not found'));
  }

  if (discountType) coupon.discountType = discountType;
  if (discountValue !== undefined) coupon.discountValue = Number(discountValue);
  if (expiryDate) coupon.expiryDate = new Date(expiryDate);
  if (usageLimit !== undefined) coupon.usageLimit = Number(usageLimit);
  if (active !== undefined) coupon.active = active;

  await coupon.save();

  res.status(200).json(new ApiResponse(200, coupon, 'Coupon updated successfully'));
});

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new ApiError(404, 'Coupon not found'));
  }

  await Coupon.deleteOne({ _id: coupon._id });

  res.status(200).json(new ApiResponse(200, null, 'Coupon deleted successfully'));
});
