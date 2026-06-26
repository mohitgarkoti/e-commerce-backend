const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

const getOrCreateUserWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ user: userId }).populate({
    path: 'products',
    select: 'name slug sku price salePrice images quantity stockStatus isActive',
  });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, products: [] });
  }

  // Clean out any inactive products
  const originalLen = wishlist.products.length;
  wishlist.products = wishlist.products.filter((p) => p && p.isActive);
  if (wishlist.products.length !== originalLen) {
    await wishlist.save();
  }

  return wishlist;
};

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = catchAsync(async (req, res, next) => {
  const wishlist = await getOrCreateUserWishlist(req.user.id);
  res.status(200).json(new ApiResponse(200, wishlist, 'Wishlist fetched successfully'));
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
exports.addToWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new ApiError(404, 'Product not found or inactive'));
  }

  const wishlist = await getOrCreateUserWishlist(req.user.id);

  if (wishlist.products.some((p) => p._id.toString() === productId)) {
    return res.status(200).json(new ApiResponse(200, wishlist, 'Product already exists in wishlist'));
  }

  wishlist.products.push(productId);
  await wishlist.save();

  const updatedWishlist = await getOrCreateUserWishlist(req.user.id);
  res.status(200).json(new ApiResponse(200, updatedWishlist, 'Product added to wishlist successfully'));
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  const { productId } = req.params;

  const wishlist = await getOrCreateUserWishlist(req.user.id);

  const productIndex = wishlist.products.findIndex((p) => p._id.toString() === productId);

  if (productIndex === -1) {
    return next(new ApiError(404, 'Product not found in wishlist'));
  }

  wishlist.products.splice(productIndex, 1);
  await wishlist.save();

  const updatedWishlist = await getOrCreateUserWishlist(req.user.id);
  res.status(200).json(new ApiResponse(200, updatedWishlist, 'Product removed from wishlist successfully'));
});

// @desc    Move item from wishlist to cart
// @route   POST /api/wishlist/move-to-cart
// @access  Private
exports.moveToCart = catchAsync(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  // Find product and verify stock
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return next(new ApiError(404, 'Product not found or inactive'));
  }

  if (product.quantity === 0) {
    return next(new ApiError(400, 'Product is out of stock'));
  }

  // Remove from Wishlist
  const wishlist = await getOrCreateUserWishlist(req.user.id);
  const prodIndex = wishlist.products.findIndex((p) => p._id.toString() === productId);
  if (prodIndex > -1) {
    wishlist.products.splice(prodIndex, 1);
    await wishlist.save();
  }

  // Add to Cart
  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId);

  if (itemIndex > -1) {
    if (cart.items[itemIndex].quantity + 1 <= product.quantity) {
      cart.items[itemIndex].quantity += 1;
    }
  } else {
    cart.items.push({ product: productId, quantity: 1 });
  }

  await cart.save();

  const finalWishlist = await getOrCreateUserWishlist(req.user.id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        wishlist: finalWishlist,
      },
      'Product moved to cart successfully'
    )
  );
});
