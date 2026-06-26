const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// Get cart helper to ensure cart is always initialized and populated
const getOrCreateUserCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'name slug sku price salePrice images quantity stockStatus isActive',
  });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Filter out any deleted or inactive products from the cart representation
  const originalCount = cart.items.length;
  cart.items = cart.items.filter((item) => item.product && item.product.isActive);

  if (cart.items.length !== originalCount) {
    await cart.save();
  }

  return cart;
};

// @desc    Get user's shopping cart
// @route   GET /api/cart
// @access  Private
exports.getCart = catchAsync(async (req, res, next) => {
  const cart = await getOrCreateUserCart(req.user.id);
  res.status(200).json(new ApiResponse(200, cart, 'Cart fetched successfully'));
});

// @desc    Add product to cart
// @route   POST /api/cart
// @access  Private
exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity) || 1;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new ApiError(404, 'Product not found or inactive'));
  }

  if (product.quantity === 0) {
    return next(new ApiError(400, 'Product is out of stock'));
  }

  const cart = await getOrCreateUserCart(req.user.id);

  // Check if item already in cart
  const itemIndex = cart.items.findIndex((item) => item.product._id.toString() === productId);

  if (itemIndex > -1) {
    // Increase quantity
    const newQty = cart.items[itemIndex].quantity + qty;
    if (newQty > product.quantity) {
      return next(new ApiError(400, `Only ${product.quantity} items are available in stock`));
    }
    cart.items[itemIndex].quantity = newQty;
  } else {
    // Add new item
    if (qty > product.quantity) {
      return next(new ApiError(400, `Only ${product.quantity} items are available in stock`));
    }
    cart.items.push({ product: productId, quantity: qty });
  }

  await cart.save();
  
  // Refetch to get fully populated product info
  const updatedCart = await getOrCreateUserCart(req.user.id);

  res.status(200).json(new ApiResponse(200, updatedCart, 'Product added to cart successfully'));
});

// @desc    Update cart item quantity
// @route   PUT /api/cart
// @access  Private
exports.updateCartItem = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const qty = Number(quantity);

  if (!productId || qty === undefined || qty < 1) {
    return next(new ApiError(400, 'Valid Product ID and quantity >= 1 are required'));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  if (qty > product.quantity) {
    return next(new ApiError(400, `Only ${product.quantity} items are available in stock`));
  }

  const cart = await getOrCreateUserCart(req.user.id);

  const itemIndex = cart.items.findIndex((item) => item.product._id.toString() === productId);

  if (itemIndex === -1) {
    return next(new ApiError(404, 'Product not found in cart'));
  }

  cart.items[itemIndex].quantity = qty;
  await cart.save();

  const updatedCart = await getOrCreateUserCart(req.user.id);
  res.status(200).json(new ApiResponse(200, updatedCart, 'Cart updated successfully'));
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
exports.removeFromCart = catchAsync(async (req, res, next) => {
  const { productId } = req.params;

  const cart = await getOrCreateUserCart(req.user.id);

  const itemIndex = cart.items.findIndex((item) => item.product._id.toString() === productId);

  if (itemIndex === -1) {
    return next(new ApiError(404, 'Product not found in cart'));
  }

  cart.items.splice(itemIndex, 1);
  
  // If cart is empty, clean up coupon
  if (cart.items.length === 0) {
    cart.couponCode = null;
    cart.discount = 0;
  }

  await cart.save();

  const updatedCart = await getOrCreateUserCart(req.user.id);
  res.status(200).json(new ApiResponse(200, updatedCart, 'Item removed from cart successfully'));
});

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = catchAsync(async (req, res, next) => {
  const cart = await getOrCreateUserCart(req.user.id);
  cart.items = [];
  cart.couponCode = null;
  cart.discount = 0;
  await cart.save();

  res.status(200).json(new ApiResponse(200, cart, 'Cart cleared successfully'));
});
