const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc    Create / Update a product review
// @route   POST /api/reviews
// @access  Private
exports.createReview = catchAsync(async (req, res, next) => {
  const { productId, rating, comment } = req.body;

  if (!productId || !rating || !comment) {
    return next(new ApiError(400, 'Product ID, rating, and comment are required'));
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Verify user has actually purchased this item (optional, but highly professional for verified purchase badge!)
  const hasPurchased = await Order.findOne({
    user: req.user.id,
    orderStatus: 'delivered',
    'items.product': productId,
  });

  const verifiedPurchase = !!hasPurchased;

  // Check if already reviewed
  let review = await Review.findOne({ product: productId, user: req.user.id });

  if (review) {
    // Update review
    review.rating = Number(rating);
    review.comment = comment;
    await review.save();
    
    // Explicitly run aggregate calculation in case pre/post hook needs triggers
    await Review.calculateAverageRating(productId);
    
    return res.status(200).json(new ApiResponse(200, review, 'Review updated successfully'));
  }

  // Create review
  review = await Review.create({
    product: productId,
    user: req.user.id,
    rating: Number(rating),
    comment,
  });

  res.status(201).json(new ApiResponse(201, { review, verifiedPurchase }, 'Review submitted successfully'));
});

// @desc    Get all reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = catchAsync(async (req, res, next) => {
  const { productId } = req.params;

  const reviews = await Review.find({ product: productId, isActive: true })
    .populate('user', 'name avatar')
    .sort('-createdAt');

  // Check which reviews belong to verified buyers
  const enrichedReviews = [];
  for (const r of reviews) {
    const hasBought = await Order.findOne({
      user: r.user._id,
      orderStatus: 'delivered',
      'items.product': productId,
    });
    enrichedReviews.push({
      ...r.toObject(),
      verifiedPurchase: !!hasBought,
    });
  }

  res.status(200).json(new ApiResponse(200, enrichedReviews, 'Reviews fetched successfully'));
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Review not found'));
  }

  // User can only delete their own reviews, admins can delete any
  if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Unauthorized to delete this review'));
  }

  const productId = review.product;

  // Delete review
  await Review.deleteOne({ _id: review._id });

  // Recalculate product rating
  await Review.calculateAverageRating(productId);

  res.status(200).json(new ApiResponse(200, null, 'Review deleted successfully'));
});
