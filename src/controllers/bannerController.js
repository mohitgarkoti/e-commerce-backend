const Banner = require('../models/Banner');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Get all active banners
// @route   GET /api/banners
// @access  Public
exports.getBanners = catchAsync(async (req, res, next) => {
  const filter = {};
  
  if (!req.user || req.user.role !== 'admin') {
    filter.active = true;
  }

  // Option to filter by banner type (e.g. hero, promo, category, offer)
  if (req.query.type) {
    filter.type = req.query.type;
  }

  const banners = await Banner.find(filter).sort('-createdAt');
  res.status(200).json(new ApiResponse(200, banners, 'Banners fetched successfully'));
});

// @desc    Create banner (Admin only)
// @route   POST /api/banners
// @access  Private/Admin
exports.createBanner = catchAsync(async (req, res, next) => {
  const { title, subtitle, type, link, active } = req.body;

  if (!type) {
    if (req.file) fs.unlinkSync(req.file.path);
    return next(new ApiError(400, 'Banner type is required'));
  }

  if (!req.file) {
    return next(new ApiError(400, 'Banner image is required'));
  }

  try {
    const imageData = await uploadImage(req.file.path, 'banners');
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const banner = await Banner.create({
      title,
      subtitle,
      type,
      link,
      image: imageData,
      active: active === 'false' ? false : true,
    });

    res.status(201).json(new ApiResponse(201, banner, 'Banner created successfully'));
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return next(new ApiError(500, `Banner image upload failed: ${err.message}`));
  }
});

// @desc    Update banner (Admin only)
// @route   PUT /api/banners/:id
// @access  Private/Admin
exports.updateBanner = catchAsync(async (req, res, next) => {
  const { title, subtitle, type, link, active } = req.body;
  const banner = await Banner.findById(req.params.id);

  if (!banner) {
    if (req.file) fs.unlinkSync(req.file.path);
    return next(new ApiError(404, 'Banner not found'));
  }

  if (title !== undefined) banner.title = title;
  if (subtitle !== undefined) banner.subtitle = subtitle;
  if (type) banner.type = type;
  if (link !== undefined) banner.link = link;
  if (active !== undefined) banner.active = active === 'false' ? false : true;

  if (req.file) {
    try {
      if (banner.image && banner.image.public_id) {
        await deleteImage(banner.image.public_id);
      }

      const imageData = await uploadImage(req.file.path, 'banners');
      banner.image = imageData;

      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (err) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return next(new ApiError(500, `Banner image replacement failed: ${err.message}`));
    }
  }

  await banner.save();

  res.status(200).json(new ApiResponse(200, banner, 'Banner updated successfully'));
});

// @desc    Delete banner (Admin only)
// @route   DELETE /api/banners/:id
// @access  Private/Admin
exports.deleteBanner = catchAsync(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id);

  if (!banner) {
    return next(new ApiError(404, 'Banner not found'));
  }

  if (banner.image && banner.image.public_id) {
    await deleteImage(banner.image.public_id);
  }

  await Banner.deleteOne({ _id: banner._id });

  res.status(200).json(new ApiResponse(200, null, 'Banner deleted successfully'));
});
