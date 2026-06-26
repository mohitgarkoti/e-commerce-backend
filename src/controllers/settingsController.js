const Settings = require('../models/Settings');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const fs = require('fs');

// Helper to fetch or create global settings document
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({ key: 'global_settings' });
  if (!settings) {
    settings = await Settings.create({ key: 'global_settings' });
  }
  return settings;
};

// @desc    Get website settings (logo, socials, SMTP, SEO, CMS pages)
// @route   GET /api/settings
// @access  Public
exports.getSettings = catchAsync(async (req, res, next) => {
  const settings = await getOrCreateSettings();
  res.status(200).json(new ApiResponse(200, settings, 'Settings fetched successfully'));
});

// @desc    Update settings configurations (Admin only)
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = catchAsync(async (req, res, next) => {
  const settings = await getOrCreateSettings();

  const {
    contactInfo,
    socialLinks,
    seoSettings,
    paymentSettings,
  } = req.body;

  // Update object properties if provided (handles stringified JSON from multipart forms)
  if (contactInfo) {
    const parsedContact = typeof contactInfo === 'string' ? JSON.parse(contactInfo) : contactInfo;
    settings.contactInfo = { ...settings.contactInfo, ...parsedContact };
  }

  if (socialLinks) {
    const parsedSocial = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
    settings.socialLinks = { ...settings.socialLinks, ...parsedSocial };
  }

  if (seoSettings) {
    const parsedSeo = typeof seoSettings === 'string' ? JSON.parse(seoSettings) : seoSettings;
    settings.seoSettings = { ...settings.seoSettings, ...parsedSeo };
  }

  if (paymentSettings) {
    const parsedPay = typeof paymentSettings === 'string' ? JSON.parse(paymentSettings) : paymentSettings;
    settings.paymentSettings = { ...settings.paymentSettings, ...parsedPay };
  }

  // Handle Logo Upload
  if (req.files && req.files.websiteLogo) {
    const file = req.files.websiteLogo[0];
    try {
      if (settings.websiteLogo && settings.websiteLogo.public_id) {
        await deleteImage(settings.websiteLogo.public_id);
      }
      const imgData = await uploadImage(file.path, 'settings');
      settings.websiteLogo = imgData;
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return next(new ApiError(500, `Logo upload failed: ${err.message}`));
    }
  }

  // Handle Favicon Upload
  if (req.files && req.files.favicon) {
    const file = req.files.favicon[0];
    try {
      if (settings.favicon && settings.favicon.public_id) {
        await deleteImage(settings.favicon.public_id);
      }
      const imgData = await uploadImage(file.path, 'settings');
      settings.favicon = imgData;
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return next(new ApiError(500, `Favicon upload failed: ${err.message}`));
    }
  }

  await settings.save();
  res.status(200).json(new ApiResponse(200, settings, 'Settings updated successfully'));
});

// @desc    Update CMS Pages content (Admin only)
// @route   PUT /api/settings/cms
// @access  Private/Admin
exports.updateCMSPage = catchAsync(async (req, res, next) => {
  const settings = await getOrCreateSettings();
  const { aboutUs, contactUs, faqs, privacyPolicy, termsConditions, returnPolicy } = req.body;

  if (aboutUs !== undefined) settings.cmsPages.aboutUs = aboutUs;
  if (contactUs !== undefined) settings.cmsPages.contactUs = contactUs;
  if (privacyPolicy !== undefined) settings.cmsPages.privacyPolicy = privacyPolicy;
  if (termsConditions !== undefined) settings.cmsPages.termsConditions = termsConditions;
  if (returnPolicy !== undefined) settings.cmsPages.returnPolicy = returnPolicy;

  if (faqs) {
    settings.cmsPages.faqs = typeof faqs === 'string' ? JSON.parse(faqs) : faqs;
  }

  await settings.save();
  res.status(200).json(new ApiResponse(200, settings, 'CMS Pages updated successfully'));
});

// ================= ADMIN ANALYTICS =================

// @desc    Get dashboard metrics (Admin only)
// @route   GET /api/settings/dashboard
// @access  Private/Admin
exports.getDashboardAnalytics = catchAsync(async (req, res, next) => {
  // 1. Total Revenue (confirmed, processing, packed, shipped, delivered)
  const confirmedOrders = await Order.find({
    orderStatus: { $nin: ['pending', 'cancelled'] },
  });
  const totalRevenue = confirmedOrders.reduce((sum, order) => sum + order.finalAmount, 0);

  // 2. Counts
  const totalOrders = await Order.countDocuments();
  const totalProducts = await Product.countDocuments();
  const totalCustomers = await User.countDocuments({ role: 'customer' });

  // 3. Recent Orders
  const recentOrders = await Order.find()
    .populate('user', 'name email')
    .sort('-createdAt')
    .limit(5);

  // 4. Sales analytics (aggregate sales per month/day)
  // We will group sales by day in the last 7 days for a chart
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailySales = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        orderStatus: { $nin: ['pending', 'cancelled'] },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        sales: { $sum: '$finalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalCustomers,
        recentOrders,
        salesAnalytics: dailySales,
      },
      'Dashboard analytics compiled successfully'
    )
  );
});
